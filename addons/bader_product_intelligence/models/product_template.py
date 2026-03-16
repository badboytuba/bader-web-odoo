# -*- coding: utf-8 -*-

import re
import unicodedata

from odoo import _, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    bpi_brand_name = fields.Char(string="Marca Producto Intelligence", default="Bader")
    bpi_slug = fields.Char(string="Slug Producto Intelligence")
    bpi_previous_price = fields.Float(string="Precio Anterior")
    bpi_featured = fields.Boolean(string="Destacado", default=False)

    bpi_geo_title = fields.Char(string="GEO Title")
    bpi_geo_description = fields.Text(string="GEO Description")
    bpi_ai_generated_description = fields.Html(string="Descripcion IA")
    bpi_ai_target_audience = fields.Selection(
        [
            ("clinicas", "Clinicas"),
            ("laboratorios", "Laboratorios"),
            ("estudiantes", "Estudiantes"),
            ("general", "General"),
        ],
        string="Audiencia IA",
        default="clinicas",
    )
    bpi_ai_tone = fields.Selection(
        [
            ("profesional", "Profesional"),
            ("tecnico", "Tecnico"),
            ("comercial", "Comercial"),
        ],
        string="Tono IA",
        default="profesional",
    )
    bpi_geo_features = fields.Json(string="Features GEO", default=list)
    bpi_seo_score = fields.Integer(string="SEO Score", default=0)
    bpi_geo_score = fields.Integer(string="GEO Score", default=0)
    bpi_competitiveness_score = fields.Integer(string="Competitiveness Score", default=0)
    bpi_last_analyzed_at = fields.Datetime(string="Ultimo Analisis")
    bpi_video_url = fields.Char(string="Video URL")
    bpi_video_embed_url = fields.Char(string="Video Embed URL", compute="_compute_bpi_video_embed_url")
    bpi_competitive_strategy = fields.Json(string="Estrategia Competitiva", default=dict)
    bpi_competitive_strategy_updated_at = fields.Datetime(string="Estrategia Actualizada")

    bpi_intelligent_niches = fields.Json(string="Nichos Inteligentes", default=list)
    bpi_intelligent_type = fields.Char(string="Tipo Inteligente")
    bpi_intelligent_subcategory = fields.Char(string="Subcategoria Inteligente")
    bpi_intelligent_category_manual = fields.Boolean(string="Categoria Manual", default=False)
    bpi_intelligent_path = fields.Char(string="Ruta Inteligente", compute="_compute_bpi_intelligent_path")

    bpi_keyword_ids = fields.One2many(
        "bpi.product.keyword",
        "product_tmpl_id",
        string="Keywords",
    )
    bpi_faq_ids = fields.One2many(
        "bpi.product.faq",
        "product_tmpl_id",
        string="FAQs",
    )
    bpi_image_ids = fields.One2many(
        "bpi.product.image",
        "product_tmpl_id",
        string="Imagenes IA",
    )
    bpi_competitor_ids = fields.One2many(
        "bpi.product.competitor",
        "product_tmpl_id",
        string="Competidores",
    )
    bpi_chat_session_ids = fields.One2many(
        "bpi.product.chat.session",
        "product_tmpl_id",
        string="Sesiones Chat IA",
    )

    def _bpi_exchange_rate(self):
        value = self.env["ir.config_parameter"].sudo().get_param("bader_product_intelligence.exchange_rate", "1650")
        try:
            return int(float(value or 1650))
        except Exception:
            return 1650

    def _bpi_generate_slug_value(self, value=False):
        text = value or self.name or ""
        normalized = unicodedata.normalize("NFKD", text)
        ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
        slug_value = re.sub(r"[^a-zA-Z0-9\s-]", "", ascii_text).strip().lower()
        slug_value = re.sub(r"[-\s]+", "-", slug_value).strip("-")
        return slug_value[:100]

    def _bpi_main_category(self):
        self.ensure_one()
        if not self.public_categ_ids:
            return self.env["product.public.category"]
        return self.public_categ_ids.sorted(key=lambda rec: ((rec.complete_name or rec.name or ""), rec.id))[:1]

    def _compute_bpi_intelligent_path(self):
        for product in self:
            segments = []
            category = product._bpi_main_category()
            if category:
                segments.append(category.complete_name or category.name or "")
            if product.bpi_intelligent_type:
                segments.append(product.bpi_intelligent_type)
            if product.bpi_intelligent_subcategory:
                segments.append(product.bpi_intelligent_subcategory)
            product.bpi_intelligent_path = " / ".join([segment for segment in segments if segment])

    def _compute_bpi_video_embed_url(self):
        for product in self:
            url = product.bpi_video_url or ""
            embed_url = ""
            if "youtube.com/watch" in url:
                video_id = url.split("watch?v=")[1].split("&")[0]
                embed_url = "https://www.youtube.com/embed/%s" % video_id
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[1].split("?")[0]
                embed_url = "https://www.youtube.com/embed/%s" % video_id
            elif "youtube.com/shorts/" in url:
                video_id = url.split("youtube.com/shorts/")[1].split("?")[0]
                embed_url = "https://www.youtube.com/embed/%s" % video_id
            else:
                instagram_match = re.search(r"/(p|reel|reels)/([A-Za-z0-9_-]+)", url)
                tiktok_match = re.search(r"video/(\d+)", url)
                if instagram_match:
                    embed_url = "https://www.instagram.com/%s/%s/embed" % (
                        instagram_match.group(1),
                        instagram_match.group(2),
                    )
                elif tiktok_match:
                    embed_url = "https://www.tiktok.com/embed/v2/%s" % tiktok_match.group(1)
            product.bpi_video_embed_url = embed_url

    def action_open_product_intelligence(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "bader_product_intelligence.action",
            "name": _("Producto Intelligence"),
            "target": "current",
            "params": {"product_tmpl_id": self.id, "origin": "product_form"},
        }

    def _bpi_keyword_values(self, keyword_type):
        self.ensure_one()
        return self.bpi_keyword_ids.filtered(lambda rec: rec.keyword_type == keyword_type).mapped("name")

    def _bpi_reference_images_payload(self):
        self.ensure_one()
        payload = []
        if self.image_1920:
            payload.append(
                {
                    "token": "main",
                    "label": _("Principal"),
                    "url": "/web/image/product.template/%s/image_1920" % self.id,
                }
            )

        approved_images = self.bpi_image_ids.filtered(lambda rec: rec.state == "approved").sorted("sequence")
        for image in approved_images:
            payload.append(
                {
                    "token": "bpi:%s" % image.id,
                    "label": image.name or _("Variacion IA"),
                    "url": "/web/image/bpi.product.image/%s/image_1920" % image.id,
                }
            )
        return payload

    def _bpi_gallery_payload(self):
        self.ensure_one()
        payload = []
        if self.image_1920:
            payload.append(
                {
                    "id": "main",
                    "name": _("Imagen principal"),
                    "imageUrl": "/web/image/product.template/%s/image_1920" % self.id,
                    "imageType": "main",
                    "prompt": "",
                    "state": "approved",
                    "sequence": 0,
                }
            )
        for image in self.bpi_image_ids.filtered(lambda rec: rec.state == "approved").sorted("sequence"):
            payload.append(
                {
                    "id": image.id,
                    "name": image.name,
                    "imageUrl": "/web/image/bpi.product.image/%s/image_1920" % image.id,
                    "imageType": image.image_type,
                    "prompt": image.prompt or "",
                    "state": image.state,
                    "sequence": image.sequence,
                }
            )
        return payload

    def _bpi_categories_payload(self):
        category_model = self.env["product.public.category"]
        return [
            {
                "id": category.id,
                "name": category.name,
                "completeName": category.complete_name or category.name,
            }
            for category in category_model.search([], order="complete_name asc")
        ]

    def bpi_dashboard_payload(self, exchange_rate=False):
        self.ensure_one()
        exchange_rate = exchange_rate or self._bpi_exchange_rate()
        category = self._bpi_main_category()
        price = float(self.list_price or 0.0)
        local_price = price * exchange_rate
        return {
            "id": self.id,
            "name": self.name or "",
            "sku": self.default_code or "",
            "brand": self.bpi_brand_name or "Bader",
            "category": category.name if category else "",
            "categoryPath": category.complete_name if category else "",
            "priceUsd": price,
            "previousPriceUsd": float(self.bpi_previous_price or 0.0),
            "costUsd": float(self.standard_price or 0.0),
            "localExchangeRate": exchange_rate,
            "priceLocal": local_price,
            "mainImageUrl": "/web/image/product.template/%s/image_1920" % self.id if self.image_1920 else False,
            "qtyAvailable": float(self.qty_available or 0.0),
            "inStock": bool((self.qty_available or 0.0) > 0),
            "isPublished": bool(self.website_published),
            "featured": bool(self.bpi_featured),
            "isArchived": not bool(self.active),
            "isDiscontinued": not bool(self.sale_ok),
            "seoScore": int(self.bpi_seo_score or 0),
            "margin": (
                ((float(self.list_price or 0.0) - float(self.standard_price or 0.0)) / float(self.list_price or 1.0) * 100.0)
                if self.list_price and self.standard_price
                else 0.0
            ),
        }

    def bpi_build_payload(self):
        self.ensure_one()
        category = self._bpi_main_category()
        exchange_rate = self._bpi_exchange_rate()
        latest_session = self.bpi_chat_session_ids.sorted(lambda rec: rec.write_date or rec.create_date, reverse=True)[:1]
        chat_messages = []
        if latest_session:
            chat_messages = [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "createdAt": msg.create_date.isoformat() if msg.create_date else False,
                }
                for msg in latest_session.message_ids.sorted("id")
            ]

        current_slug = self.bpi_slug or self._bpi_generate_slug_value()
        seo_data = {
            "seoTitle": self.website_meta_title or self.name or "",
            "seoDescription": self.website_meta_description or "",
            "seoKeywords": self._bpi_keyword_values("seo"),
            "geoTitle": self.bpi_geo_title or "",
            "geoDescription": self.bpi_geo_description or "",
            "geoFeatures": self.bpi_geo_features or [],
            "geoFaq": [
                {
                    "id": faq.id,
                    "question": faq.question,
                    "answer": faq.answer,
                }
                for faq in self.bpi_faq_ids.sorted("sequence")
            ],
            "aiGeneratedDescription": self.bpi_ai_generated_description or "",
            "aiTargetAudience": self.bpi_ai_target_audience or "clinicas",
            "aiTone": self.bpi_ai_tone or "profesional",
            "seoScore": self.bpi_seo_score,
            "geoScore": self.bpi_geo_score,
            "competitivenessScore": self.bpi_competitiveness_score,
            "lastAnalyzedAt": self.bpi_last_analyzed_at.isoformat() if self.bpi_last_analyzed_at else False,
        }

        return {
            "product": {
                "id": self.id,
                "name": self.name or "",
                "description": self.description_sale or self.description or "",
                "sku": self.default_code or "",
                "slug": current_slug,
                "brand": self.bpi_brand_name or "Bader",
                "category": category.name if category else "",
                "categoryPath": category.complete_name if category else "",
                "categoryId": category.id if category else False,
                "priceUsd": float(self.list_price or 0.0),
                "previousPriceUsd": float(self.bpi_previous_price or 0.0),
                "costUsd": float(self.standard_price or 0.0),
                "localExchangeRate": exchange_rate,
                "priceLocal": float(self.list_price or 0.0) * exchange_rate,
                "qtyAvailable": float(self.qty_available or 0.0),
                "inStock": bool((self.qty_available or 0.0) > 0),
                "isPublished": bool(self.website_published),
                "featured": bool(self.bpi_featured),
                "dataLabel": _("Producto Bader: SKU origen %s") % (self.default_code or "-"),
                "mainImageUrl": "/web/image/product.template/%s/image_1920" % self.id if self.image_1920 else False,
                "videoUrl": self.bpi_video_url or "",
                "videoEmbedUrl": self.bpi_video_embed_url or "",
                "referenceImages": self._bpi_reference_images_payload(),
                "intelligentNiches": self.bpi_intelligent_niches or [],
                "intelligentType": self.bpi_intelligent_type or "",
                "intelligentSubcategory": self.bpi_intelligent_subcategory or "",
                "intelligentCategoryManual": bool(self.bpi_intelligent_category_manual),
                "intelligentPath": self.bpi_intelligent_path or "",
                "websiteUrl": self.website_url or "",
            },
            "seoData": seo_data,
            "images": self._bpi_gallery_payload(),
            "competitors": [competitor.bpi_to_payload() for competitor in self.bpi_competitor_ids.sorted(lambda rec: rec.id, reverse=True)],
            "categoryIntelligence": category.bpi_to_payload() if category else False,
            "availableCategories": self._bpi_categories_payload(),
            "chatHistory": chat_messages,
            "chatSessionId": latest_session.session_key if latest_session else False,
            "competitiveStrategy": self.bpi_competitive_strategy or {},
            "exchangeRate": exchange_rate,
        }
