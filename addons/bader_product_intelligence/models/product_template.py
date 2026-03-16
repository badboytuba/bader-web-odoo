# -*- coding: utf-8 -*-

import re

from odoo import _, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    bpi_geo_title = fields.Char(string="GEO Title")
    bpi_geo_description = fields.Text(string="GEO Description")
    bpi_ai_generated_description = fields.Html(string="Descripción IA")
    bpi_ai_target_audience = fields.Selection(
        [
            ("clinicas", "Clínicas"),
            ("laboratorios", "Laboratorios"),
            ("estudiantes", "Estudiantes"),
            ("general", "General"),
        ],
        string="Audiencia IA",
        default="clinicas",
    )
    bpi_geo_features = fields.Json(string="Features GEO", default=list)
    bpi_seo_score = fields.Integer(string="SEO Score", default=0)
    bpi_geo_score = fields.Integer(string="GEO Score", default=0)
    bpi_competitiveness_score = fields.Integer(string="Competitiveness Score", default=0)
    bpi_last_analyzed_at = fields.Datetime(string="Último Análisis")
    bpi_video_url = fields.Char(string="Video URL")
    bpi_video_embed_url = fields.Char(string="Video Embed URL", compute="_compute_bpi_video_embed_url")
    bpi_competitive_strategy = fields.Json(string="Estrategia Competitiva", default=dict)
    bpi_competitive_strategy_updated_at = fields.Datetime(string="Estrategia Actualizada")

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
        string="Imágenes IA",
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
                    embed_url = "https://www.instagram.com/%s/%s/embed" % (instagram_match.group(1), instagram_match.group(2))
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
            "params": {"product_tmpl_id": self.id},
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

        for image in self.bpi_image_ids.filtered(lambda rec: rec.state == "approved").sorted("sequence"):
            payload.append(
                {
                    "token": "bpi:%s" % image.id,
                    "label": image.name or _("Variación IA"),
                    "url": "/web/image/bpi.product.image/%s/image_1920" % image.id,
                }
            )
        return payload

    def bpi_build_payload(self):
        self.ensure_one()
        category = self.public_categ_ids[:1]
        latest_session = self.bpi_chat_session_ids.sorted(lambda rec: rec.write_date or rec.create_date, reverse=True)[:1]
        chat_messages = []
        if latest_session:
            chat_messages = [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.create_date.isoformat() if msg.create_date else False,
                }
                for msg in latest_session.message_ids.sorted("id")
            ]

        seo_data = {
            "seoTitle": self.website_meta_title or "",
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
            "seoScore": self.bpi_seo_score,
            "geoScore": self.bpi_geo_score,
            "competitivenessScore": self.bpi_competitiveness_score,
            "lastAnalyzedAt": self.bpi_last_analyzed_at.isoformat() if self.bpi_last_analyzed_at else False,
        }

        return {
            "product": {
                "id": self.id,
                "name": self.name,
                "description": self.description_sale or self.description or "",
                "sku": self.default_code or "",
                "category": category.name if category else "",
                "price": self.list_price,
                "isPublished": bool(self.website_published),
                "mainImageUrl": "/web/image/product.template/%s/image_1920" % self.id if self.image_1920 else False,
                "videoUrl": self.bpi_video_url or "",
                "referenceImages": self._bpi_reference_images_payload(),
            },
            "seoData": seo_data,
            "images": [
                {
                    "id": image.id,
                    "name": image.name,
                    "imageUrl": "/web/image/bpi.product.image/%s/image_1920" % image.id,
                    "imageType": image.image_type,
                    "prompt": image.prompt or "",
                    "state": image.state,
                    "sequence": image.sequence,
                }
                for image in self.bpi_image_ids.filtered(lambda rec: rec.state == "approved").sorted("sequence")
            ],
            "competitors": [competitor.bpi_to_payload() for competitor in self.bpi_competitor_ids.sorted(lambda rec: rec.id, reverse=True)],
            "categoryIntelligence": category.bpi_to_payload() if category else False,
            "chatHistory": chat_messages,
            "chatSessionId": latest_session.session_key if latest_session else False,
            "competitiveStrategy": self.bpi_competitive_strategy or {},
        }
