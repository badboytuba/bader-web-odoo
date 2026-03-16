/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart, useState } from "@odoo/owl";

class ProductIntelligenceAction extends Component {
    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        this.action = useService("action");
        this.state = useState({
            loading: true,
            error: "",
            productId: null,
            data: null,
            activeTab: "seo",
            seoForm: this.emptySeoForm(),
            seoAudience: "clinicas",
            seoBusy: false,
            imagePrompt: "",
            generatedPreviewUrl: "",
            imageBusy: false,
            selectedReferences: [],
            imageStyle: "professional",
            videoUrl: "",
            competitorName: "",
            competitorUrl: "",
            competitorBusy: false,
            discoveredCompetitors: [],
            discoveryQuery: "",
            strategyBusy: false,
            strategy: null,
            chatInput: "",
            chatSending: false,
            chatMessages: [],
            chatSessionId: null,
        });
        this.quickActions = [
            "Sugiere una descripcion atractiva",
            "Como mejorar el SEO de este producto?",
            "Ideas de promociones",
            "Analiza el precio vs competencia",
        ];
        onWillStart(async () => {
            this.state.productId = this.resolveProductId();
            if (!this.state.productId) {
                this.state.error = "No se recibió un producto para Producto Intelligence.";
                this.state.loading = false;
                return;
            }
            await this.loadData();
        });
    }

    emptySeoForm() {
        return {
            seoTitle: "",
            seoDescription: "",
            seoKeywords: "",
            geoTitle: "",
            geoDescription: "",
            geoFeatures: "",
            aiGeneratedDescription: "",
        };
    }

    resolveProductId() {
        const params = this.props.action.params || {};
        const context = this.props.action.context || {};
        return params.product_tmpl_id || context.active_id || null;
    }

    arrayToText(values) {
        return (values || []).join(", ");
    }

    textToArray(text) {
        return (text || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    syncSeoForm(seoData = {}) {
        this.state.seoForm = {
            seoTitle: seoData.seoTitle || "",
            seoDescription: seoData.seoDescription || "",
            seoKeywords: this.arrayToText(seoData.seoKeywords),
            geoTitle: seoData.geoTitle || "",
            geoDescription: seoData.geoDescription || "",
            geoFeatures: this.arrayToText(seoData.geoFeatures),
            aiGeneratedDescription: seoData.aiGeneratedDescription || "",
        };
        this.state.videoUrl = (this.state.data && this.state.data.product.videoUrl) || "";
    }

    notify(title, type = "success") {
        this.notification.add(title, { type });
    }

    async loadData() {
        this.state.loading = true;
        try {
            const data = await this.rpc("/bader_product_intelligence/data", {
                product_tmpl_id: this.state.productId,
            });
            this.state.data = data;
            this.state.strategy = data.competitiveStrategy || null;
            this.state.chatMessages = data.chatHistory || [];
            this.state.chatSessionId = data.chatSessionId || null;
            this.syncSeoForm(data.seoData || {});
            this.state.selectedReferences = (data.product.referenceImages || []).length ? [data.product.referenceImages[0].token] : [];
            this.state.error = "";
        } catch (error) {
            this.state.error = error.message || "No se pudo cargar Producto Intelligence.";
        } finally {
            this.state.loading = false;
        }
    }

    openProductForm() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "product.template",
            res_id: this.state.productId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    selectTab(tab) {
        this.state.activeTab = tab;
    }

    async analyzeSeo() {
        this.state.seoBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/analyze_seo", {
                product_tmpl_id: this.state.productId,
                target_audience: this.state.seoAudience,
            });
            this.state.data.seoData = result.seoData;
            this.syncSeoForm(result.seoData);
            this.notify("Análisis SEO/GEO completado");
        } catch (error) {
            this.notify(error.message || "Error al analizar SEO", "danger");
        } finally {
            this.state.seoBusy = false;
        }
    }

    async saveSeo() {
        this.state.seoBusy = true;
        try {
            const seoData = {
                seoTitle: this.state.seoForm.seoTitle,
                seoDescription: this.state.seoForm.seoDescription,
                seoKeywords: this.textToArray(this.state.seoForm.seoKeywords),
                geoTitle: this.state.seoForm.geoTitle,
                geoDescription: this.state.seoForm.geoDescription,
                geoFeatures: this.textToArray(this.state.seoForm.geoFeatures),
                geoFaq: (this.state.data.seoData && this.state.data.seoData.geoFaq) || [],
                aiGeneratedDescription: this.state.seoForm.aiGeneratedDescription,
                aiTargetAudience: this.state.seoAudience,
                seoScore: (this.state.data.seoData && this.state.data.seoData.seoScore) || 0,
                geoScore: (this.state.data.seoData && this.state.data.seoData.geoScore) || 0,
                competitivenessScore: (this.state.data.seoData && this.state.data.seoData.competitivenessScore) || 0,
            };
            const result = await this.rpc("/bader_product_intelligence/save_seo", {
                product_tmpl_id: this.state.productId,
                seo_data: seoData,
            });
            this.state.data.seoData = result.seoData;
            this.syncSeoForm(result.seoData);
            this.notify("SEO guardado");
        } catch (error) {
            this.notify(error.message || "Error al guardar SEO", "danger");
        } finally {
            this.state.seoBusy = false;
        }
    }

    toggleReference(token) {
        if (this.state.selectedReferences.includes(token)) {
            this.state.selectedReferences = this.state.selectedReferences.filter((item) => item !== token);
        } else {
            this.state.selectedReferences.push(token);
        }
    }

    async generateImage(usePro = false) {
        if (!this.state.imagePrompt.trim()) {
            this.notify("Escribí un prompt para generar la imagen", "warning");
            return;
        }
        this.state.imageBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/generate_image", {
                product_tmpl_id: this.state.productId,
                prompt: this.state.imagePrompt,
                reference_tokens: this.state.selectedReferences,
                style: this.state.imageStyle,
                use_pro: usePro,
            });
            this.state.generatedPreviewUrl = result.previewUrl || "";
            this.notify("Preview generado");
        } catch (error) {
            this.notify(error.message || "Error al generar imagen", "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async approveImage() {
        if (!this.state.generatedPreviewUrl) {
            return;
        }
        this.state.imageBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/approve_image", {
                product_tmpl_id: this.state.productId,
                image_data_url: this.state.generatedPreviewUrl,
                prompt: this.state.imagePrompt,
            });
            this.state.generatedPreviewUrl = "";
            this.state.imagePrompt = "";
            await this.loadData();
            this.notify("Imagen aprobada y guardada");
        } catch (error) {
            this.notify(error.message || "Error al aprobar imagen", "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async deleteImage(imageId) {
        try {
            await this.rpc("/bader_product_intelligence/delete_image", { image_id: imageId });
            await this.loadData();
            this.notify("Imagen eliminada");
        } catch (error) {
            this.notify(error.message || "Error al eliminar imagen", "danger");
        }
    }

    async saveVideo() {
        try {
            await this.rpc("/bader_product_intelligence/save_video", {
                product_tmpl_id: this.state.productId,
                video_url: this.state.videoUrl,
            });
            this.state.data.product.videoUrl = this.state.videoUrl;
            this.notify("Video guardado");
        } catch (error) {
            this.notify(error.message || "Error al guardar video", "danger");
        }
    }

    async discoverCompetitors() {
        this.state.competitorBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/discover_competitors", {
                product_tmpl_id: this.state.productId,
                limit: 10,
            });
            this.state.discoveredCompetitors = result.competitors || [];
            this.state.discoveryQuery = result.query || "";
            this.notify(`Se encontraron ${result.totalFound || 0} competidores potenciales`);
        } catch (error) {
            this.notify(error.message || "Error al buscar competidores", "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async addCompetitor(name, url) {
        const competitorName = name || this.state.competitorName;
        const competitorUrl = url || this.state.competitorUrl;
        if (!competitorUrl) {
            this.notify("Ingresá una URL de competidor", "warning");
            return;
        }
        this.state.competitorBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/add_competitor", {
                product_tmpl_id: this.state.productId,
                competitor_name: competitorName,
                competitor_url: competitorUrl,
            });
            this.state.competitorName = "";
            this.state.competitorUrl = "";
            await this.loadData();
            this.notify("Competidor agregado y scrapeado");
        } catch (error) {
            this.notify(error.message || "Error al agregar competidor", "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async scrapeCompetitor(competitorId) {
        try {
            await this.rpc("/bader_product_intelligence/scrape_competitor", { competitor_id: competitorId });
            await this.loadData();
            this.notify("Scraping completado");
        } catch (error) {
            this.notify(error.message || "Error al scrapear competidor", "danger");
        }
    }

    async analyzeCompetitor(competitorId) {
        try {
            await this.rpc("/bader_product_intelligence/analyze_competitor", { competitor_id: competitorId });
            await this.loadData();
            this.notify("Análisis de competidor completado");
        } catch (error) {
            this.notify(error.message || "Error al analizar competidor", "danger");
        }
    }

    async deleteCompetitor(competitorId) {
        try {
            await this.rpc("/bader_product_intelligence/delete_competitor", { competitor_id: competitorId });
            await this.loadData();
            this.notify("Competidor eliminado");
        } catch (error) {
            this.notify(error.message || "Error al eliminar competidor", "danger");
        }
    }

    async generateStrategy() {
        this.state.strategyBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/generate_strategy", {
                product_tmpl_id: this.state.productId,
            });
            this.state.strategy = result.strategy || {};
            this.notify("Estrategia competitiva generada");
        } catch (error) {
            this.notify(error.message || "Error al generar estrategia", "danger");
        } finally {
            this.state.strategyBusy = false;
        }
    }

    async sendQuickAction(message) {
        this.state.chatInput = message;
        await this.sendChat();
    }

    async sendChat() {
        const message = (this.state.chatInput || "").trim();
        if (!message) {
            return;
        }
        this.state.chatMessages.push({ role: "user", content: message });
        this.state.chatInput = "";
        this.state.chatSending = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/chat", {
                product_tmpl_id: this.state.productId,
                message,
                session_id: this.state.chatSessionId,
            });
            this.state.chatSessionId = result.sessionId;
            this.state.chatMessages.push({ role: "assistant", content: result.response });
        } catch (error) {
            this.notify(error.message || "Error en el chat", "danger");
        } finally {
            this.state.chatSending = false;
        }
    }
}

ProductIntelligenceAction.template = "bader_product_intelligence.ProductIntelligenceAction";
registry.category("actions").add("bader_product_intelligence.action", ProductIntelligenceAction);
