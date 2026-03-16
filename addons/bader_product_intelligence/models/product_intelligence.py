# -*- coding: utf-8 -*-

import base64
import ipaddress
import json
import logging
import math
import os
import re
import socket
import uuid
from urllib.parse import urlparse

import requests

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression

_logger = logging.getLogger(__name__)


class BPIProductKeyword(models.Model):
    _name = "bpi.product.keyword"
    _description = "Producto Intelligence Keyword"
    _order = "sequence, id"

    product_tmpl_id = fields.Many2one("product.template", required=True, ondelete="cascade")
    name = fields.Char(required=True)
    keyword_type = fields.Selection(
        [("seo", "SEO"), ("geo", "GEO")],
        required=True,
        default="seo",
    )
    sequence = fields.Integer(default=10)


class BPIProductFaq(models.Model):
    _name = "bpi.product.faq"
    _description = "Producto Intelligence FAQ"
    _order = "sequence, id"

    product_tmpl_id = fields.Many2one("product.template", required=True, ondelete="cascade")
    question = fields.Char(required=True)
    answer = fields.Text(required=True)
    sequence = fields.Integer(default=10)


class BPIProductImage(models.Model):
    _name = "bpi.product.image"
    _description = "Producto Intelligence Image"
    _order = "sequence, id desc"

    product_tmpl_id = fields.Many2one("product.template", required=True, ondelete="cascade")
    name = fields.Char(required=True)
    image_1920 = fields.Image(required=True, attachment=True)
    mime_type = fields.Char()
    prompt = fields.Text()
    image_type = fields.Selection(
        [
            ("ai_generated", "IA"),
            ("reference", "Referencia"),
        ],
        default="ai_generated",
        required=True,
    )
    state = fields.Selection(
        [
            ("approved", "Approved"),
            ("preview", "Preview"),
            ("rejected", "Rejected"),
        ],
        default="approved",
        required=True,
    )
    sequence = fields.Integer(default=10)


class BPIProductCompetitor(models.Model):
    _name = "bpi.product.competitor"
    _description = "Producto Intelligence Competitor"
    _order = "id desc"

    product_tmpl_id = fields.Many2one("product.template", required=True, ondelete="cascade")
    competitor_name = fields.Char(required=True)
    competitor_url = fields.Char(required=True)
    competitor_price = fields.Float()
    competitor_offer_price = fields.Float()
    competitor_currency = fields.Char(default="ARS")
    competitor_title = fields.Char()
    competitor_description = fields.Text()
    competitor_features = fields.Json(default=list)
    meta_title = fields.Char()
    meta_description = fields.Text()
    meta_keywords = fields.Json(default=list)
    h1_tags = fields.Json(default=list)
    h2_tags = fields.Json(default=list)
    og_title = fields.Char()
    og_description = fields.Text()
    og_image = fields.Char()
    canonical_url = fields.Char()
    structured_data = fields.Json(default=list)
    page_content = fields.Text()
    word_count = fields.Integer()
    image_count = fields.Integer()
    internal_links = fields.Integer()
    external_links = fields.Integer()
    seo_score = fields.Integer()
    price_comparison = fields.Selection(
        [
            ("cheaper", "Más barato"),
            ("similar", "Similar"),
            ("expensive", "Más caro"),
        ],
        default="similar",
    )
    strengths_vs_us = fields.Json(default=list)
    weaknesses_vs_us = fields.Json(default=list)
    firecrawl_data = fields.Json(default=dict)
    scrape_status = fields.Selection(
        [
            ("pending", "Pending"),
            ("success", "Success"),
            ("failed", "Failed"),
        ],
        default="pending",
    )
    scrape_error = fields.Text()
    last_scraped_at = fields.Datetime()

    def bpi_to_payload(self):
        self.ensure_one()
        return {
            "id": self.id,
            "competitorName": self.competitor_name,
            "competitorUrl": self.competitor_url,
            "competitorPrice": self.competitor_price,
            "competitorOfferPrice": self.competitor_offer_price,
            "competitorCurrency": self.competitor_currency,
            "competitorTitle": self.competitor_title or "",
            "competitorDescription": self.competitor_description or "",
            "competitorFeatures": self.competitor_features or [],
            "priceComparison": self.price_comparison or "similar",
            "strengthsVsUs": self.strengths_vs_us or [],
            "weaknessesVsUs": self.weaknesses_vs_us or [],
            "lastScrapedAt": self.last_scraped_at.isoformat() if self.last_scraped_at else False,
            "metaTitle": self.meta_title or "",
            "metaDescription": self.meta_description or "",
            "metaKeywords": self.meta_keywords or [],
            "h1Tags": self.h1_tags or [],
            "h2Tags": self.h2_tags or [],
            "ogTitle": self.og_title or "",
            "ogDescription": self.og_description or "",
            "ogImage": self.og_image or "",
            "canonicalUrl": self.canonical_url or "",
            "structuredData": self.structured_data or [],
            "pageContent": self.page_content or "",
            "wordCount": self.word_count or 0,
            "imageCount": self.image_count or 0,
            "internalLinks": self.internal_links or 0,
            "externalLinks": self.external_links or 0,
            "seoScore": self.seo_score or 0,
            "firecrawlData": self.firecrawl_data or {},
            "scrapeStatus": self.scrape_status or "pending",
            "scrapeError": self.scrape_error or "",
        }


class BPIProductChatSession(models.Model):
    _name = "bpi.product.chat.session"
    _description = "Producto Intelligence Chat Session"
    _order = "write_date desc, id desc"

    product_tmpl_id = fields.Many2one("product.template", required=True, ondelete="cascade")
    name = fields.Char(required=True)
    session_key = fields.Char(required=True, index=True, default=lambda self: str(uuid.uuid4()))
    message_ids = fields.One2many("bpi.product.chat.message", "session_id", string="Mensajes")


class BPIProductChatMessage(models.Model):
    _name = "bpi.product.chat.message"
    _description = "Producto Intelligence Chat Message"
    _order = "id"

    session_id = fields.Many2one("bpi.product.chat.session", required=True, ondelete="cascade")
    role = fields.Selection(
        [
            ("user", "User"),
            ("assistant", "Assistant"),
            ("system", "System"),
        ],
        required=True,
        default="user",
    )
    content = fields.Text(required=True)


class BPIService(models.AbstractModel):
    _name = "bpi.service"
    _description = "Producto Intelligence Service"

    _ENV_FALLBACKS = {
        "bader_product_intelligence.gemini_api_key": [
            "BPI_GEMINI_API_KEY",
            "GOOGLE_API_KEY",
            "GEMINI_API_KEY",
        ],
        "bader_product_intelligence.gemini_text_model": [
            "BPI_GEMINI_TEXT_MODEL",
        ],
        "bader_product_intelligence.gemini_image_model": [
            "BPI_GEMINI_IMAGE_MODEL",
        ],
        "bader_product_intelligence.gemini_image_pro_model": [
            "BPI_GEMINI_IMAGE_PRO_MODEL",
        ],
        "bader_product_intelligence.firecrawl_api_key": [
            "BPI_FIRECRAWL_API_KEY",
            "FIRECRAWL_API_KEY",
        ],
        "bader_product_intelligence.firecrawl_base_url": [
            "BPI_FIRECRAWL_BASE_URL",
        ],
    }

    @api.model
    def _get_config(self, key, default=False):
        value = self.env["ir.config_parameter"].sudo().get_param(key)
        if value:
            return value
        for env_key in self._ENV_FALLBACKS.get(key, []):
            env_value = os.getenv(env_key)
            if env_value:
                return env_value
        return default

    @api.model
    def _require_config(self, key, label):
        value = self._get_config(key)
        if not value:
            raise UserError(_("Configura %s en Ajustes antes de usar Producto Intelligence.") % label)
        return value

    @api.model
    def _gemini_endpoint(self, model_name):
        api_key = self._require_config("bader_product_intelligence.gemini_api_key", "Gemini API Key")
        return "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s" % (
            model_name,
            api_key,
        )

    @api.model
    def _clean_json_text(self, raw_text):
        raw_text = (raw_text or "").strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?", "", raw_text).strip()
            raw_text = re.sub(r"```$", "", raw_text).strip()
        return raw_text

    @api.model
    def _parse_gemini_text(self, payload):
        candidates = payload.get("candidates") or []
        texts = []
        for candidate in candidates:
            content = candidate.get("content") or {}
            for part in content.get("parts") or []:
                if part.get("text"):
                    texts.append(part["text"])
        return "\n".join(texts).strip()

    @api.model
    def _gemini_request(self, model_name, contents, generation_config=None):
        try:
            response = requests.post(
                self._gemini_endpoint(model_name),
                json={
                    "contents": contents,
                    "generationConfig": generation_config or {},
                },
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as error:
            _logger.exception("Gemini request failed for model %s", model_name)
            raise UserError(
                _("No se pudo completar la solicitud a Gemini. Revisa la configuracion e intenta de nuevo.")
            ) from error
        except ValueError as error:
            _logger.exception("Gemini returned a non-JSON response for model %s", model_name)
            raise UserError(_("Gemini devolvio una respuesta invalida.")) from error

    @api.model
    def _gemini_json(self, prompt, model_name=False):
        model_name = model_name or self._get_config("bader_product_intelligence.gemini_text_model", "gemini-2.5-flash")
        payload = self._gemini_request(
            model_name,
            [{"role": "user", "parts": [{"text": prompt}]}],
            {"responseMimeType": "application/json"},
        )
        text = self._clean_json_text(self._parse_gemini_text(payload))
        if not text:
            raise UserError(_("Gemini no devolvió contenido JSON."))
        try:
            return json.loads(text)
        except ValueError as error:
            _logger.exception("Gemini returned invalid JSON: %s", text[:500])
            raise UserError(_("Gemini devolvio JSON invalido para esta accion.")) from error

    @api.model
    def _image_mime_from_base64(self, encoded):
        try:
            raw = base64.b64decode(encoded)
        except Exception:
            return "image/png"
        signatures = (
            (b"\x89PNG\r\n\x1a\n", "image/png"),
            (b"\xff\xd8\xff", "image/jpeg"),
            (b"GIF87a", "image/gif"),
            (b"GIF89a", "image/gif"),
            (b"RIFF", "image/webp"),
        )
        for signature, mime_type in signatures:
            if raw.startswith(signature):
                if mime_type == "image/webp" and raw[8:12] != b"WEBP":
                    continue
                return mime_type
        return "image/png"

    @api.model
    def _binary_to_inline_data(self, binary_value):
        if not binary_value:
            return False
        encoded = binary_value.decode() if isinstance(binary_value, bytes) else binary_value
        return {
            "inlineData": {
                "mimeType": self._image_mime_from_base64(encoded),
                "data": encoded,
            }
        }

    @api.model
    def _reference_parts(self, product, reference_tokens):
        parts = []
        for token in reference_tokens or []:
            if token == "main" and product.image_1920:
                inline = self._binary_to_inline_data(product.image_1920)
                if inline:
                    parts.append(inline)
                continue

            if token.startswith("bpi:"):
                image_id = int(token.split(":")[1])
                image = self.env["bpi.product.image"].browse(image_id).exists()
                if image and image.product_tmpl_id == product:
                    inline = self._binary_to_inline_data(image.image_1920)
                    if inline:
                        parts.append(inline)
        return parts

    @api.model
    def _extract_inline_image(self, payload):
        for candidate in payload.get("candidates") or []:
            content = candidate.get("content") or {}
            for part in content.get("parts") or []:
                inline = part.get("inlineData")
                if inline and inline.get("data"):
                    return inline
        raise UserError(_("Gemini no devolvió una imagen válida."))

    @api.model
    def _detect_price_comparison(self, our_price, competitor_price):
        if not our_price or not competitor_price:
            return "similar"
        diff = (competitor_price - our_price) / max(our_price, 0.01)
        if diff > 0.10:
            return "expensive"
        if diff < -0.10:
            return "cheaper"
        return "similar"

    @api.model
    def _extract_meta_tag(self, html, tag_name):
        if not html:
            return ""
        regex = re.compile(r'<meta\s+name=["\']%s["\']\s+content=["\']([^"\']+)["\']' % re.escape(tag_name), re.I)
        alt_regex = re.compile(r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']%s["\']' % re.escape(tag_name), re.I)
        match = regex.search(html) or alt_regex.search(html)
        return match.group(1).strip() if match else ""

    @api.model
    def _extract_meta_property(self, html, prop_name):
        if not html:
            return ""
        regex = re.compile(r'<meta\s+property=["\']%s["\']\s+content=["\']([^"\']+)["\']' % re.escape(prop_name), re.I)
        alt_regex = re.compile(r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']%s["\']' % re.escape(prop_name), re.I)
        match = regex.search(html) or alt_regex.search(html)
        return match.group(1).strip() if match else ""

    @api.model
    def _extract_headings(self, html, tag):
        if not html:
            return []
        pattern = re.compile(r"<%s[^>]*>(.*?)</%s>" % (tag, tag), re.I | re.S)
        values = []
        for match in pattern.finditer(html):
            text = re.sub(r"<[^>]+>", "", match.group(1) or "").strip()
            if text:
                values.append(text[:200])
        return values[:10]

    @api.model
    def _extract_structured_data(self, html):
        if not html:
            return []
        pattern = re.compile(r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)
        items = []
        for match in pattern.finditer(html):
            try:
                items.append(json.loads(match.group(1)))
            except Exception:
                continue
        return items

    @api.model
    def _extract_prices(self, html, markdown, structured_data):
        price = False
        offer_price = False
        currency = "ARS"
        for data in structured_data or []:
            if isinstance(data, dict) and data.get("@type") == "Product" and data.get("offers"):
                offers = data["offers"][0] if isinstance(data["offers"], list) else data["offers"]
                if offers.get("price"):
                    try:
                        price = float(str(offers["price"]).replace(",", "."))
                    except Exception:
                        pass
                    currency = offers.get("priceCurrency") or "ARS"
                if offers.get("lowPrice"):
                    try:
                        offer_price = float(str(offers["lowPrice"]).replace(",", "."))
                    except Exception:
                        pass
                break

        if not price:
            text = "%s\n%s" % (html or "", markdown or "")
            match = re.search(r"\$\s?([\d\.\,]+)", text)
            if match:
                normalized = match.group(1).replace(".", "").replace(",", ".")
                try:
                    price = float(normalized)
                except Exception:
                    price = False
        return price, offer_price, currency

    @api.model
    def _extract_features(self, markdown):
        features = []
        for line in (markdown or "").splitlines():
            clean = line.strip(" -*\t")
            if clean and len(clean) > 8 and len(clean) < 160:
                features.append(clean)
            if len(features) >= 10:
                break
        return features

    @api.model
    def _count_links(self, html, base_url):
        internal = 0
        external = 0
        if not html:
            return internal, external
        host = urlparse(base_url).netloc
        for match in re.finditer(r'href=["\']([^"\']+)["\']', html, re.I):
            href = match.group(1)
            if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
                continue
            parsed = urlparse(href)
            if not parsed.netloc or parsed.netloc == host:
                internal += 1
            else:
                external += 1
        return internal, external

    @api.model
    def _calculate_seo_score(self, meta_title, meta_description, h1_tags, structured_data, og_title, og_description, canonical_url, word_count, image_count, h2_tags):
        score = 0
        if meta_title:
            score += 15
        if meta_description:
            score += 15
        if h1_tags:
            score += 10
        if structured_data:
            score += 15
        if og_title and og_description:
            score += 10
        if canonical_url:
            score += 10
        if 50 <= len(meta_title or "") <= 65:
            score += 10
        if 120 <= len(meta_description or "") <= 165:
            score += 10
        if (word_count or 0) >= 300:
            score += 10
        if (image_count or 0) >= 3:
            score += 5
        if (len(h2_tags or [])) >= 2:
            score += 5
        return min(score, 100)

    @api.model
    def save_seo_payload(self, product, data):
        product.ensure_one()
        seo_keywords = [kw.strip() for kw in (data.get("seoKeywords") or []) if kw and kw.strip()]
        geo_keywords = [kw.strip() for kw in (data.get("geoKeywords") or data.get("geoFeatures") or []) if kw and kw.strip()]
        faqs = data.get("geoFaq") or []
        product.write(
            {
                "website_meta_title": data.get("seoTitle") or "",
                "website_meta_description": data.get("seoDescription") or "",
                "bpi_geo_title": data.get("geoTitle") or "",
                "bpi_geo_description": data.get("geoDescription") or "",
                "bpi_geo_features": data.get("geoFeatures") or [],
                "bpi_ai_generated_description": data.get("aiGeneratedDescription") or "",
                "bpi_ai_target_audience": data.get("aiTargetAudience") or "clinicas",
                "bpi_seo_score": int(data.get("seoScore") or 0),
                "bpi_geo_score": int(data.get("geoScore") or 0),
                "bpi_competitiveness_score": int(data.get("competitivenessScore") or 0),
                "bpi_last_analyzed_at": fields.Datetime.now(),
            }
        )

        product.bpi_keyword_ids.unlink()
        keyword_commands = []
        for index, keyword in enumerate(seo_keywords):
            keyword_commands.append((0, 0, {"name": keyword, "keyword_type": "seo", "sequence": index * 10 + 10}))
        for index, keyword in enumerate(geo_keywords):
            keyword_commands.append((0, 0, {"name": keyword, "keyword_type": "geo", "sequence": index * 10 + 10}))
        if keyword_commands:
            product.write({"bpi_keyword_ids": keyword_commands})

        product.bpi_faq_ids.unlink()
        faq_commands = []
        for index, faq in enumerate(faqs):
            question = (faq or {}).get("question")
            answer = (faq or {}).get("answer")
            if question and answer:
                faq_commands.append((0, 0, {"question": question, "answer": answer, "sequence": index * 10 + 10}))
        if faq_commands:
            product.write({"bpi_faq_ids": faq_commands})
        return product.bpi_build_payload()["seoData"]

    @api.model
    def analyze_seo(self, product, target_audience):
        product.ensure_one()
        prompt = """Sos Nancy AI, experta en marketing dental para Bader Argentina.

Analizá este producto y devolvé exclusivamente un JSON válido con esta estructura:
{
  "seoTitle": "",
  "seoDescription": "",
  "seoKeywords": [],
  "geoTitle": "",
  "geoDescription": "",
  "geoFaq": [{"question": "", "answer": ""}],
  "geoFeatures": [],
  "geoKeywords": [],
  "aiGeneratedDescription": "",
  "aiTargetAudience": "",
  "seoScore": 0,
  "geoScore": 0,
  "competitivenessScore": 0
}

Producto:
- Nombre: %(name)s
- SKU: %(sku)s
- Categoría: %(category)s
- Precio: %(price)s
- Descripción: %(description)s

Audiencia objetivo: %(audience)s

Reglas:
- Español argentino.
- SEO title máximo 60 caracteres.
- Meta description máximo 160 caracteres.
- 5 a 8 keywords SEO.
- 4 a 6 features GEO.
- 4 a 7 FAQs claras para compra y evaluación técnica.
- Descripción entre 180 y 260 palabras.
- Enfocá SEO tradicional y GEO para motores de IA.
""" % {
            "name": product.name,
            "sku": product.default_code or "N/A",
            "category": (product.public_categ_ids[:1].name if product.public_categ_ids else "Sin categoría"),
            "price": product.list_price,
            "description": product.description_sale or product.description or "Sin descripción",
            "audience": target_audience or "clinicas",
        }
        analysis = self._gemini_json(prompt)
        analysis.setdefault("aiTargetAudience", target_audience or "clinicas")
        self.save_seo_payload(product, analysis)
        return product.bpi_build_payload()["seoData"]

    @api.model
    def _validate_external_url(self, raw_url):
        clean_url = (raw_url or "").strip()
        parsed = urlparse(clean_url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise UserError(_("Ingresa una URL externa válida."))

        hostname = (parsed.hostname or "").strip().lower()
        if not hostname:
            raise UserError(_("Ingresa una URL externa válida."))
        if hostname in ("localhost", "0.0.0.0") or hostname.endswith(".local") or hostname.endswith(".internal"):
            raise UserError(_("La URL apunta a una red privada o interna y no está permitida."))

        try:
            host_entries = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        except socket.gaierror as error:
            raise UserError(_("No se pudo resolver el dominio indicado.")) from error

        for entry in host_entries:
            ip_address = ipaddress.ip_address(entry[4][0])
            if (
                ip_address.is_private
                or ip_address.is_loopback
                or ip_address.is_link_local
                or ip_address.is_multicast
                or ip_address.is_reserved
                or ip_address.is_unspecified
            ):
                raise UserError(_("La URL apunta a una red privada o interna y no está permitida."))

        return clean_url

    @api.model
    def _dashboard_base_domain(self):
        return []

    @api.model
    def _dashboard_search_domain(self, search):
        term = (search or "").strip()
        if not term:
            return []
        return expression.OR(
            [
                [("name", "ilike", term)],
                [("default_code", "ilike", term)],
                [("bpi_brand_name", "ilike", term)],
                [("public_categ_ids.name", "ilike", term)],
            ]
        )

    @api.model
    def _dashboard_tab_domain(self, tab):
        active_sale_domain = [("active", "=", True), ("sale_ok", "=", True)]
        if tab == "new":
            return expression.AND([active_sale_domain, [("website_published", "=", False)]])
        if tab == "discontinued":
            return expression.OR([[("active", "=", False)], [("sale_ok", "=", False)]])
        return active_sale_domain

    @api.model
    def _dashboard_stats(self):
        product_model = self.env["product.template"].with_context(active_test=False)
        base_domain = self._dashboard_base_domain()
        return {
            "total": product_model.search_count(base_domain),
            "published": product_model.search_count(expression.AND([base_domain, [("website_published", "=", True)]])),
            "featured": product_model.search_count(expression.AND([base_domain, [("bpi_featured", "=", True)]])),
            "pending": product_model.search_count(expression.AND([base_domain, [("website_published", "=", False)]])),
        }

    @api.model
    def dashboard_payload(self, tab="all", search="", page=1, limit=40):
        product_model = self.env["product.template"].with_context(active_test=False)
        exchange_rate = product_model._bpi_exchange_rate()
        safe_page = max(int(page or 1), 1)
        safe_limit = min(max(int(limit or 40), 1), 120)
        base_domain = self._dashboard_base_domain()
        query_domain = expression.AND([base_domain, self._dashboard_tab_domain(tab), self._dashboard_search_domain(search)])
        total_rows = product_model.search_count(query_domain)
        if total_rows and (safe_page - 1) * safe_limit >= total_rows:
            safe_page = max(1, int(math.ceil(total_rows / float(safe_limit))))
        offset = (safe_page - 1) * safe_limit
        products = product_model.search(
            query_domain,
            order="website_sequence asc, name asc, id desc",
            offset=offset,
            limit=safe_limit,
        )
        rows = [product.bpi_dashboard_payload(exchange_rate=exchange_rate) for product in products]
        page_count = max(1, int(math.ceil(total_rows / float(safe_limit))) if total_rows else 1)
        return {
            "products": rows,
            "exchangeRate": exchange_rate,
            "stats": self._dashboard_stats(),
            "tabCounts": {
                "all": product_model.search_count(expression.AND([base_domain, self._dashboard_tab_domain("all")])),
                "new": product_model.search_count(expression.AND([base_domain, self._dashboard_tab_domain("new")])),
                "discontinued": product_model.search_count(expression.AND([base_domain, self._dashboard_tab_domain("discontinued")])),
            },
            "pager": {
                "page": safe_page,
                "pageCount": page_count,
                "total": total_rows,
                "limit": safe_limit,
                "hasNext": safe_page < page_count,
                "hasPrevious": safe_page > 1,
            },
        }

    @api.model
    def sync_catalog(self, tab="all", search="", page=1, limit=40):
        return self.dashboard_payload(tab=tab, search=search, page=page, limit=limit)

    @api.model
    def update_exchange_rate(self, exchange_rate):
        value = int(float(exchange_rate or 1650))
        self.env["ir.config_parameter"].sudo().set_param("bader_product_intelligence.exchange_rate", value)
        return {"success": True, "exchangeRate": value}

    @api.model
    def update_product(self, product, values):
        product.ensure_one()
        values = values or {}
        write_values = {}
        if "name" in values:
            write_values["name"] = (values.get("name") or "").strip() or product.name
        if "sku" in values:
            write_values["default_code"] = (values.get("sku") or "").strip() or False
        if "slug" in values:
            write_values["bpi_slug"] = product._bpi_generate_slug_value(values.get("slug"))
        if "brand" in values:
            write_values["bpi_brand_name"] = (values.get("brand") or "Bader").strip() or "Bader"
        if "priceUsd" in values:
            write_values["list_price"] = float(values.get("priceUsd") or 0.0)
        if "previousPriceUsd" in values:
            write_values["bpi_previous_price"] = float(values.get("previousPriceUsd") or 0.0)
        if "isPublished" in values:
            write_values["website_published"] = bool(values.get("isPublished"))
        if "featured" in values:
            write_values["bpi_featured"] = bool(values.get("featured"))

        category_id = values.get("categoryId")
        if category_id:
            write_values["public_categ_ids"] = [(6, 0, [int(category_id)])]
        elif "categoryId" in values:
            write_values["public_categ_ids"] = [(5, 0, 0)]

        if write_values:
            product.write(write_values)

        if "costUsd" in values:
            cost_value = float(values.get("costUsd") or 0.0)
            if product.product_variant_id:
                product.product_variant_id.write({"standard_price": cost_value})
            else:
                product.write({"standard_price": cost_value})

        if "description" in values:
            description_value = values.get("description") or False
            product.write(
                {
                    "description_sale": description_value,
                    "bpi_ai_generated_description": description_value,
                }
            )

        return product.bpi_build_payload()

    @api.model
    def generate_content(self, product, tone="profesional", audience="clinicas"):
        product.ensure_one()
        prompt = """Sos Nancy AI, copywriter de e-commerce dental para Bader Argentina.

Devolve solo JSON valido:
{
  "name": "",
  "description": ""
}

Producto:
- Nombre: %(name)s
- SKU: %(sku)s
- Categoria: %(category)s
- Precio USD: %(price)s
- Descripcion actual: %(description)s

Tono: %(tone)s
Audiencia: %(audience)s

Reglas:
- Espanol argentino.
- Mantene un enfoque comercial y tecnico.
- El nombre puede ajustarse ligeramente para mejorar claridad.
- La descripcion debe tener entre 140 y 260 palabras.
- Incluir beneficios, uso recomendado y credenciales de marca.
- No inventes prestaciones clinicas que no surjan del contexto.
""" % {
            "name": product.name,
            "sku": product.default_code or "N/A",
            "category": product.public_categ_ids[:1].complete_name if product.public_categ_ids else "Sin categoria",
            "price": product.list_price,
            "description": product.description_sale or product.description or "Sin descripcion",
            "tone": tone or "profesional",
            "audience": audience or "clinicas",
        }
        response = self._gemini_json(prompt)
        return {
            "name": response.get("name") or product.name,
            "description": response.get("description") or product.description_sale or product.description or "",
            "tone": tone or "profesional",
            "audience": audience or "clinicas",
        }

    @api.model
    def _save_faq_items(self, product, faqs):
        product.bpi_faq_ids.unlink()
        commands = []
        for index, faq in enumerate(faqs or []):
            question = (faq or {}).get("question", "").strip()
            answer = (faq or {}).get("answer", "").strip()
            if question and answer:
                commands.append(
                    (
                        0,
                        0,
                        {
                            "question": question,
                            "answer": answer,
                            "sequence": index * 10 + 10,
                        },
                    )
                )
        if commands:
            product.write({"bpi_faq_ids": commands})

    @api.model
    def save_content(self, product, values):
        product.ensure_one()
        values = values or {}
        write_values = {}
        if "name" in values:
            write_values["name"] = (values.get("name") or "").strip() or product.name
        if "description" in values:
            write_values["description_sale"] = values.get("description") or False
            write_values["bpi_ai_generated_description"] = values.get("description") or False
        if "audience" in values:
            write_values["bpi_ai_target_audience"] = values.get("audience") or "clinicas"
        if "tone" in values:
            write_values["bpi_ai_tone"] = values.get("tone") or "profesional"
        if write_values:
            product.write(write_values)
        if "faqs" in values:
            self._save_faq_items(product, values.get("faqs") or [])
        return product.bpi_build_payload()

    @api.model
    def generate_faq(self, product, audience="clinicas"):
        product.ensure_one()
        prompt = """Sos Nancy AI y tenes que crear preguntas frecuentes de compra para un producto dental.

Devolve solo JSON valido:
{
  "faqs": [
    {"question": "", "answer": ""}
  ]
}

Producto:
- Nombre: %(name)s
- SKU: %(sku)s
- Categoria: %(category)s
- Descripcion: %(description)s

Audiencia: %(audience)s

Reglas:
- Espanol argentino.
- Entre 4 y 6 FAQs.
- Preguntas claras, orientadas a compra y uso real.
- Respuestas cortas, directas y con tono profesional.
""" % {
            "name": product.name,
            "sku": product.default_code or "N/A",
            "category": product.public_categ_ids[:1].complete_name if product.public_categ_ids else "Sin categoria",
            "description": product.description_sale or product.description or "Sin descripcion",
            "audience": audience or "clinicas",
        }
        response = self._gemini_json(prompt)
        return {"faqs": response.get("faqs") or []}

    @api.model
    def save_category(self, product, values):
        product.ensure_one()
        values = values or {}
        product.write(
            {
                "bpi_intelligent_niches": values.get("niches") or [],
                "bpi_intelligent_type": values.get("type") or False,
                "bpi_intelligent_subcategory": values.get("subcategory") or False,
                "bpi_intelligent_category_manual": bool(values.get("manualMode")),
            }
        )
        category_id = values.get("categoryId")
        if category_id:
            product.write({"public_categ_ids": [(6, 0, [int(category_id)])]})
        return product.bpi_build_payload()

    @api.model
    def reclassify_category(self, product):
        product.ensure_one()
        prompt = """Sos Nancy AI. Clasifica un producto dental para el catalogo de Bader Argentina.

Devolve solo JSON valido:
{
  "niches": [],
  "type": "",
  "subcategory": ""
}

Producto:
- Nombre: %(name)s
- Categoria actual: %(category)s
- Descripcion: %(description)s

Reglas:
- Niches permitidos: clinica, laboratorio, estudiantes.
- Type debe ser una familia comercial corta.
- Subcategory debe ser concreta y entendible para catalogo.
""" % {
            "name": product.name,
            "category": product.public_categ_ids[:1].complete_name if product.public_categ_ids else "Sin categoria",
            "description": product.description_sale or product.description or "Sin descripcion",
        }
        response = self._gemini_json(prompt)
        values = {
            "niches": [value for value in (response.get("niches") or []) if value],
            "type": response.get("type") or False,
            "subcategory": response.get("subcategory") or False,
            "manualMode": False,
        }
        return self.save_category(product, values)

    @api.model
    def generate_image(self, product, prompt, reference_tokens=None, style="professional", use_pro=False):
        product.ensure_one()
        image_model = self._get_config(
            "bader_product_intelligence.gemini_image_pro_model" if use_pro else "bader_product_intelligence.gemini_image_model",
            "gemini-2.5-flash-image",
        )
        style_map = {
            "professional": "fotografía de producto profesional, fondo blanco limpio, iluminación de estudio",
            "lifestyle": "escena lifestyle en consultorio dental moderno",
            "artistic": "composición artística premium y llamativa",
            "minimalist": "composición minimalista blanca y elegante",
        }
        parts = self._reference_parts(product, reference_tokens)
        parts.append(
            {
                "text": """Generá una imagen publicitaria para Bader Argentina.
Producto: %(name)s
Pedido: %(prompt)s
Estilo: %(style)s
Reglas:
- Mantener identidad del producto.
- Aspecto premium para e-commerce.
- Solo una imagen final.
- Fondo limpio y look comercial.
""" % {
                    "name": product.name,
                    "prompt": prompt,
                    "style": style_map.get(style, style_map["professional"]),
                }
            }
        )
        payload = self._gemini_request(
            image_model,
            [{"role": "user", "parts": parts}],
            {"responseModalities": ["TEXT", "IMAGE"]},
        )
        inline = self._extract_inline_image(payload)
        return {
            "previewUrl": "data:%s;base64,%s" % (inline.get("mimeType") or "image/png", inline["data"]),
            "mimeType": inline.get("mimeType") or "image/png",
            "base64": inline["data"],
        }

    @api.model
    def save_generated_image(self, product, data_url, prompt):
        product.ensure_one()
        if not data_url or "," not in data_url:
            raise UserError(_("No llegó una imagen válida para guardar."))
        meta, encoded = data_url.split(",", 1)
        mime_type = "image/png"
        if ";" in meta and ":" in meta:
            mime_type = meta.split(":", 1)[1].split(";", 1)[0]
        image = self.env["bpi.product.image"].create(
            {
                "product_tmpl_id": product.id,
                "name": _("Variación IA %s") % fields.Datetime.now(),
                "image_1920": encoded,
                "mime_type": mime_type,
                "prompt": prompt,
                "image_type": "ai_generated",
                "state": "approved",
                "sequence": (max(product.bpi_image_ids.mapped("sequence")) + 10) if product.bpi_image_ids else 10,
            }
        )
        return {
            "id": image.id,
            "imageUrl": "/web/image/bpi.product.image/%s/image_1920" % image.id,
        }

    @api.model
    def add_image_from_url(self, product, image_url):
        product.ensure_one()
        clean_url = self._validate_external_url(image_url)
        try:
            response = requests.get(clean_url, timeout=90)
            response.raise_for_status()
        except requests.RequestException as error:
            _logger.exception("Unable to download image from %s", clean_url)
            raise UserError(_("No se pudo descargar la imagen externa.")) from error

        mime_type = (response.headers.get("Content-Type") or "image/png").split(";", 1)[0]
        if not mime_type.startswith("image/"):
            raise UserError(_("La URL indicada no devolvió una imagen válida."))
        content_length = int(response.headers.get("Content-Length") or 0)
        if content_length and content_length > 10 * 1024 * 1024:
            raise UserError(_("La imagen supera el tamaño máximo permitido de 10 MB."))
        if len(response.content or b"") > 10 * 1024 * 1024:
            raise UserError(_("La imagen supera el tamaño máximo permitido de 10 MB."))

        encoded = base64.b64encode(response.content).decode()
        image = self.env["bpi.product.image"].create(
            {
                "product_tmpl_id": product.id,
                "name": _("Imagen externa %s") % fields.Datetime.now(),
                "image_1920": encoded,
                "mime_type": mime_type,
                "prompt": _("Importada desde URL"),
                "image_type": "reference",
                "state": "approved",
                "sequence": (max(product.bpi_image_ids.mapped("sequence")) + 10) if product.bpi_image_ids else 10,
            }
        )
        return {
            "id": image.id,
            "imageUrl": "/web/image/bpi.product.image/%s/image_1920" % image.id,
        }

    @api.model
    def delete_image(self, image):
        image.unlink()
        return True

    @api.model
    def discover_competitors(self, product, limit=10):
        product.ensure_one()
        prompt = """Sos Nancy AI y tenés que listar competidores probables para un producto dental vendido en Argentina.

Devolvé solamente JSON válido:
{
  "query": "",
  "competitors": [
    {
      "name": "",
      "url": "",
      "domain": "",
      "description": "",
      "estimatedPrice": "",
      "relevanceScore": 0
    }
  ]
}

Producto:
- Nombre: %(name)s
- Categoría: %(category)s
- Marca: Bader
- Descripción: %(description)s

Reglas:
- Sitios reales o muy probables del rubro odontológico en Argentina.
- URLs en formato https://...
- relevanceScore entre 1 y 10.
- máximo %(limit)s resultados.
""" % {
            "name": product.name,
            "category": product.public_categ_ids[:1].name if product.public_categ_ids else "Sin categoría",
            "description": product.description_sale or product.description or "Sin descripción",
            "limit": limit,
        }
        response = self._gemini_json(prompt)
        competitors = (response.get("competitors") or [])[:limit]
        return {
            "success": True,
            "query": response.get("query") or product.name,
            "totalFound": len(competitors),
            "competitors": competitors,
        }

    @api.model
    def scrape_competitor(self, competitor):
        competitor.ensure_one()
        api_key = self._require_config("bader_product_intelligence.firecrawl_api_key", "Firecrawl API Key")
        base_url = self._get_config("bader_product_intelligence.firecrawl_base_url", "https://api.firecrawl.dev").rstrip("/")
        competitor.write({"scrape_status": "pending", "scrape_error": False})
        safe_url = self._validate_external_url(competitor.competitor_url)
        try:
            response = requests.post(
                "%s/v1/scrape" % base_url,
                json={
                    "url": safe_url,
                    "formats": ["markdown", "html"],
                    "includeTags": ["meta", "title", "h1", "h2", "script", "img", "a"],
                    "onlyMainContent": False,
                },
                headers={"Authorization": "Bearer %s" % api_key, "Content-Type": "application/json"},
                timeout=120,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as error:
            competitor.write(
                {
                    "scrape_status": "failed",
                    "scrape_error": str(error),
                    "last_scraped_at": fields.Datetime.now(),
                }
            )
            _logger.exception("Firecrawl scrape failed for competitor %s", competitor.id)
            raise UserError(_("No se pudo obtener el sitio del competidor desde Firecrawl.")) from error
        data = payload.get("data") or payload
        html = data.get("html") or ""
        markdown = data.get("markdown") or ""
        metadata = data.get("metadata") or {}
        meta_title = metadata.get("title") or self._extract_meta_tag(html, "title")
        meta_description = metadata.get("description") or self._extract_meta_tag(html, "description")
        meta_keywords = [kw.strip() for kw in self._extract_meta_tag(html, "keywords").split(",") if kw.strip()]
        canonical_url = ""
        canonical_match = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']', html, re.I)
        if canonical_match:
            canonical_url = canonical_match.group(1).strip()
        og_title = metadata.get("ogTitle") or self._extract_meta_property(html, "og:title")
        og_description = metadata.get("ogDescription") or self._extract_meta_property(html, "og:description")
        og_image = metadata.get("ogImage") or self._extract_meta_property(html, "og:image")
        h1_tags = self._extract_headings(html, "h1")
        h2_tags = self._extract_headings(html, "h2")
        structured_data = self._extract_structured_data(html)
        price, offer_price, currency = self._extract_prices(html, markdown, structured_data)
        features = self._extract_features(markdown)
        word_count = len(re.findall(r"\w+", markdown or ""))
        image_count = len(re.findall(r"<img\b", html or "", re.I))
        internal_links, external_links = self._count_links(html, competitor.competitor_url)
        seo_score = self._calculate_seo_score(meta_title, meta_description, h1_tags, structured_data, og_title, og_description, canonical_url, word_count, image_count, h2_tags)
        competitor.write(
            {
                "competitor_title": meta_title or competitor.competitor_title,
                "competitor_description": meta_description or competitor.competitor_description,
                "competitor_price": price or False,
                "competitor_offer_price": offer_price or False,
                "competitor_currency": currency or "ARS",
                "competitor_features": features,
                "meta_title": meta_title,
                "meta_description": meta_description,
                "meta_keywords": meta_keywords,
                "h1_tags": h1_tags,
                "h2_tags": h2_tags,
                "og_title": og_title,
                "og_description": og_description,
                "og_image": og_image,
                "canonical_url": canonical_url,
                "structured_data": structured_data,
                "page_content": (markdown or "")[:5000],
                "word_count": word_count,
                "image_count": image_count,
                "internal_links": internal_links,
                "external_links": external_links,
                "seo_score": seo_score,
                "firecrawl_data": {"metadata": metadata, "success": True},
                "scrape_status": "success",
                "scrape_error": False,
                "last_scraped_at": fields.Datetime.now(),
            }
        )
        return competitor.bpi_to_payload()

    @api.model
    def add_competitor(self, product, competitor_name, competitor_url):
        product.ensure_one()
        competitor_url = self._validate_external_url(competitor_url)
        name = competitor_name or ""
        if not name and competitor_url:
            parsed = urlparse(competitor_url)
            name = (parsed.netloc or "competidor").replace("www.", "").split(".")[0].title()
        competitor = self.env["bpi.product.competitor"].create(
            {
                "product_tmpl_id": product.id,
                "competitor_name": name or _("Competidor"),
                "competitor_url": competitor_url,
                "scrape_status": "pending",
            }
        )
        self.scrape_competitor(competitor)
        return competitor.bpi_to_payload()

    @api.model
    def analyze_competitor(self, competitor):
        competitor.ensure_one()
        product = competitor.product_tmpl_id
        prompt = """Sos Nancy AI, experta en análisis competitivo dental para Argentina.

Devolvé solo JSON:
{
  "competitorTitle": "",
  "competitorDescription": "",
  "competitorFeatures": [],
  "strengthsVsUs": [],
  "weaknessesVsUs": [],
  "priceComparison": "cheaper|similar|expensive",
  "recommendedKeywords": [],
  "contentStrategy": ""
}

Nuestro producto:
- Nombre: %(our_name)s
- Precio: %(our_price)s
- Descripción: %(our_description)s

Competidor:
- Nombre: %(name)s
- URL: %(url)s
- Título: %(title)s
- Descripción: %(description)s
- Precio: %(price)s
- Keywords: %(keywords)s
- H1: %(h1)s
- H2: %(h2)s
- Features: %(features)s
- Contenido: %(content)s
""" % {
            "our_name": product.name,
            "our_price": product.list_price,
            "our_description": product.description_sale or product.description or "Sin descripción",
            "name": competitor.competitor_name,
            "url": competitor.competitor_url,
            "title": competitor.competitor_title or "",
            "description": competitor.competitor_description or "",
            "price": competitor.competitor_offer_price or competitor.competitor_price or "",
            "keywords": ", ".join(competitor.meta_keywords or []),
            "h1": ", ".join(competitor.h1_tags or []),
            "h2": ", ".join(competitor.h2_tags or []),
            "features": ", ".join(competitor.competitor_features or []),
            "content": (competitor.page_content or "")[:1500],
        }
        analysis = self._gemini_json(prompt)
        price_comparison = analysis.get("priceComparison") or self._detect_price_comparison(
            product.list_price,
            competitor.competitor_offer_price or competitor.competitor_price,
        )
        competitor.write(
            {
                "competitor_title": analysis.get("competitorTitle") or competitor.competitor_title,
                "competitor_description": analysis.get("competitorDescription") or competitor.competitor_description,
                "competitor_features": analysis.get("competitorFeatures") or competitor.competitor_features,
                "strengths_vs_us": analysis.get("strengthsVsUs") or [],
                "weaknesses_vs_us": analysis.get("weaknessesVsUs") or [],
                "price_comparison": price_comparison,
            }
        )
        return competitor.bpi_to_payload()

    @api.model
    def generate_competitive_strategy(self, product):
        product.ensure_one()
        competitors = product.bpi_competitor_ids
        if not competitors:
            raise UserError(_("Agregá al menos un competidor antes de generar la estrategia."))
        prompt = """Sos Nancy AI. Construí una estrategia competitiva superior para Bader Argentina.

Devolvé solo JSON:
{
  "overallStrategy": "",
  "competitivePosition": "",
  "seoStrategy": {
    "recommendedTitle": "",
    "recommendedDescription": "",
    "primaryKeywords": [],
    "secondaryKeywords": [],
    "longTailKeywords": []
  },
  "geoStrategy": {
    "recommendedTitle": "",
    "recommendedDescription": "",
    "naturalQuestions": [],
    "contextualPhrases": []
  },
  "contentRecommendations": [],
  "pricingStrategy": "",
  "competitorExploits": [],
  "immediateActions": [],
  "estimatedImpact": {
    "seoScoreTarget": 0,
    "expectedRankingImprovement": "",
    "timeToResults": ""
  }
}

Producto:
- Nombre: %(name)s
- Precio: %(price)s
- Descripción: %(description)s

SEO actual:
- SEO title: %(seo_title)s
- Meta description: %(seo_description)s
- Keywords: %(seo_keywords)s

Competidores:
%(competitors)s
""" % {
            "name": product.name,
            "price": product.list_price,
            "description": product.description_sale or product.description or "",
            "seo_title": product.website_meta_title or "",
            "seo_description": product.website_meta_description or "",
            "seo_keywords": ", ".join(product._bpi_keyword_values("seo")),
            "competitors": json.dumps([comp.bpi_to_payload() for comp in competitors], ensure_ascii=False),
        }
        strategy = self._gemini_json(prompt)
        product.write(
            {
                "bpi_competitive_strategy": strategy,
                "bpi_competitive_strategy_updated_at": fields.Datetime.now(),
            }
        )
        return strategy

    @api.model
    def chat_with_product(self, product, message, session_key=False):
        product.ensure_one()
        session = self.env["bpi.product.chat.session"].search(
            [("product_tmpl_id", "=", product.id), ("session_key", "=", session_key)],
            limit=1,
        )
        if not session:
            session = self.env["bpi.product.chat.session"].create(
                {
                    "product_tmpl_id": product.id,
                    "name": _("Sesión %s") % product.name,
                    "session_key": session_key or str(uuid.uuid4()),
                }
            )
        self.env["bpi.product.chat.message"].create({"session_id": session.id, "role": "user", "content": message})
        history = session.message_ids.sorted("id")
        history_lines = []
        for item in history[-12:]:
            history_lines.append("%s: %s" % (item.role, item.content))
        prompt = """Sos Nancy AI, agente de producto para Bader Argentina.

Producto:
- Nombre: %(name)s
- SKU: %(sku)s
- Categoría: %(category)s
- Precio: %(price)s
- Descripción: %(description)s

Objetivo:
- Ayudar al administrador a mejorar contenido, SEO, GEO, pricing, marketing e imágenes.
- Responder en español argentino.
- Ser concreta, útil y accionable.

Historial:
%(history)s

Respondé al último mensaje del usuario:
%(message)s
""" % {
            "name": product.name,
            "sku": product.default_code or "",
            "category": product.public_categ_ids[:1].name if product.public_categ_ids else "",
            "price": product.list_price,
            "description": product.description_sale or product.description or "",
            "history": "\n".join(history_lines),
            "message": message,
        }
        model_name = self._get_config("bader_product_intelligence.gemini_text_model", "gemini-2.5-flash")
        payload = self._gemini_request(model_name, [{"role": "user", "parts": [{"text": prompt}]}], {})
        reply = self._parse_gemini_text(payload)
        self.env["bpi.product.chat.message"].create({"session_id": session.id, "role": "assistant", "content": reply})
        return {"response": reply, "sessionId": session.session_key}
