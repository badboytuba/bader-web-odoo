/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart, useState } from "@odoo/owl";

const DETAIL_TABS = [
    { id: "overview", label: "Overview", icon: "fa-bar-chart" },
    { id: "datos", label: "Datos", icon: "fa-cog" },
    { id: "categorization", label: "Categorization", icon: "fa-sitemap" },
    { id: "content", label: "Content", icon: "fa-pencil" },
    { id: "images", label: "Images", icon: "fa-picture-o" },
    { id: "seo", label: "SEO", icon: "fa-search" },
    { id: "competitors", label: "Competidores", icon: "fa-bullseye" },
    { id: "analytics", label: "Analytics", icon: "fa-line-chart" },
];

const NICHE_OPTIONS = [
    { id: "clinica", label: "Clinica Dental", icon: "fa-hospital-o" },
    { id: "laboratorio", label: "Laboratorio Dental", icon: "fa-flask" },
    { id: "estudiantes", label: "Estudiantes", icon: "fa-graduation-cap" },
];

const TYPE_OPTIONS = [
    { value: "consumible", label: "Consumible" },
    { value: "equipo", label: "Equipo" },
    { value: "instrumental", label: "Instrumental" },
    { value: "mobiliario", label: "Mobiliario" },
    { value: "protesis", label: "Protesis" },
    { value: "ortodoncia", label: "Ortodoncia" },
    { value: "endodoncia", label: "Endodoncia" },
    { value: "cirugia", label: "Cirugia" },
    { value: "higiene", label: "Higiene" },
    { value: "radiologia", label: "Radiologia" },
];

const SUBCATEGORY_OPTIONS = [
    { value: "adhesivos", label: "Adhesivos" },
    { value: "anestesia", label: "Anestesia" },
    { value: "blanqueamiento", label: "Blanqueamiento" },
    { value: "cementos", label: "Cementos" },
    { value: "composites", label: "Composites" },
    { value: "desechables", label: "Desechables" },
    { value: "esterilizacion", label: "Esterilizacion" },
    { value: "fresas", label: "Fresas" },
    { value: "impresion", label: "Impresion" },
    { value: "profilaxis", label: "Profilaxis" },
    { value: "restauracion", label: "Restauracion" },
    { value: "otro", label: "Otro" },
];

class ProductIntelligenceAction extends Component {
    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        this.action = useService("action");

        this.detailTabs = DETAIL_TABS;
        this.nicheOptions = NICHE_OPTIONS;
        this.typeOptions = TYPE_OPTIONS;
        this.subcategoryOptions = SUBCATEGORY_OPTIONS;

        this.state = useState({
            loading: true,
            error: "",
            viewMode: "dashboard",
            origin: "menu",
            productId: null,
            dashboardTab: "all",
            searchTerm: "",
            exchangeRateInput: "1650",
            exchangeRate: 1650,
            dashboardRows: [],
            dashboardStats: {
                total: 0,
                published: 0,
                featured: 0,
                pending: 0,
            },
            detail: null,
            activeTab: "overview",
            saveBusy: false,
            syncBusy: false,
            exchangeRateBusy: false,
            seoBusy: false,
            contentBusy: false,
            faqBusy: false,
            imageBusy: false,
            competitorBusy: false,
            strategyBusy: false,
            categoryBusy: false,
            productForm: this.emptyProductForm(),
            contentForm: this.emptyContentForm(),
            seoForm: this.emptySeoForm(),
            categoryForm: this.emptyCategoryForm(),
            imageForm: this.emptyImageForm(),
            competitorForm: this.emptyCompetitorForm(),
        });

        onWillStart(async () => {
            const productId = this.resolveProductId();
            this.state.origin = this.resolveOrigin();
            if (productId) {
                this.state.productId = productId;
                await this.loadDetail(productId);
            } else {
                await this.loadDashboard();
            }
        });
    }

    emptyProductForm() {
        return {
            name: "",
            sku: "",
            slug: "",
            brand: "Bader",
            categoryId: "",
            priceUsd: "0",
            previousPriceUsd: "",
            costUsd: "",
            qtyAvailable: "",
            featured: false,
            isPublished: false,
        };
    }

    emptyContentForm() {
        return {
            tone: "profesional",
            audience: "clinicas",
            name: "",
            description: "",
            faqs: [],
        };
    }

    emptySeoForm() {
        return {
            seoTitle: "",
            seoDescription: "",
            slug: "",
            seoKeywords: "",
            geoTitle: "",
            geoDescription: "",
            geoFeatures: "",
        };
    }

    emptyCategoryForm() {
        return {
            manualMode: false,
            niches: [],
            type: "",
            subcategory: "",
            categoryId: "",
        };
    }

    emptyImageForm() {
        return {
            prompt: "",
            style: "professional",
            selectedReferences: [],
            generatedPreviewUrl: "",
            selectedGalleryUrl: "",
            addImageUrl: "",
            videoUrl: "",
        };
    }

    emptyCompetitorForm() {
        return {
            competitorName: "",
            competitorUrl: "",
            discoveredCompetitors: [],
            discoveryQuery: "",
        };
    }

    resolveProductId() {
        const params = this.props.action.params || {};
        const context = this.props.action.context || {};
        return params.product_tmpl_id || context.active_id || null;
    }

    resolveOrigin() {
        const params = this.props.action.params || {};
        return params.origin || "menu";
    }

    notify(message, type = "success") {
        this.notification.add(message, { type });
    }

    errorMessage(error, fallback) {
        return (error && (error.message || error.data && error.data.message)) || fallback;
    }

    async loadDashboard() {
        this.state.loading = true;
        this.state.error = "";
        try {
            const data = await this.rpc("/bader_product_intelligence/dashboard", {});
            this.state.dashboardRows = data.products || [];
            this.state.dashboardStats = data.stats || {
                total: 0,
                published: 0,
                featured: 0,
                pending: 0,
            };
            this.state.exchangeRate = data.exchangeRate || 1650;
            this.state.exchangeRateInput = String(this.state.exchangeRate || 1650);
            this.state.viewMode = "dashboard";
        } catch (error) {
            this.state.error = this.errorMessage(error, "No se pudo cargar Producto Intelligence.");
        } finally {
            this.state.loading = false;
        }
    }

    applyDetailPayload(data) {
        const product = data.product || {};
        const seoData = data.seoData || {};

        this.state.detail = data;
        this.state.productForm = {
            name: product.name || "",
            sku: product.sku || "",
            slug: product.slug || "",
            brand: product.brand || "Bader",
            categoryId: product.categoryId ? String(product.categoryId) : "",
            priceUsd: this.toInput(product.priceUsd),
            previousPriceUsd: product.previousPriceUsd ? this.toInput(product.previousPriceUsd) : "",
            costUsd: product.costUsd ? this.toInput(product.costUsd) : "",
            qtyAvailable: this.toInput(product.qtyAvailable),
            featured: !!product.featured,
            isPublished: !!product.isPublished,
        };
        this.state.contentForm = {
            tone: seoData.aiTone || "profesional",
            audience: seoData.aiTargetAudience || "clinicas",
            name: product.name || "",
            description: seoData.aiGeneratedDescription || product.description || "",
            faqs: (seoData.geoFaq || []).map((faq) => ({
                question: faq.question || "",
                answer: faq.answer || "",
            })),
        };
        this.state.seoForm = {
            seoTitle: seoData.seoTitle || product.name || "",
            seoDescription: seoData.seoDescription || "",
            slug: product.slug || "",
            seoKeywords: (seoData.seoKeywords || []).join(", "),
            geoTitle: seoData.geoTitle || "",
            geoDescription: seoData.geoDescription || "",
            geoFeatures: (seoData.geoFeatures || []).join(", "),
        };
        this.state.categoryForm = {
            manualMode: !!product.intelligentCategoryManual,
            niches: product.intelligentNiches || [],
            type: product.intelligentType || "",
            subcategory: product.intelligentSubcategory || "",
            categoryId: product.categoryId ? String(product.categoryId) : "",
        };
        const defaultImage = product.mainImageUrl || (data.images && data.images.length ? data.images[0].imageUrl : "");
        this.state.imageForm = {
            prompt: "",
            style: "professional",
            selectedReferences: (product.referenceImages || []).length ? [product.referenceImages[0].token] : [],
            generatedPreviewUrl: "",
            selectedGalleryUrl: defaultImage || "",
            addImageUrl: "",
            videoUrl: product.videoUrl || "",
        };
        this.state.competitorForm = {
            competitorName: "",
            competitorUrl: "",
            discoveredCompetitors: [],
            discoveryQuery: "",
        };
        this.state.exchangeRate = data.exchangeRate || this.state.exchangeRate || 1650;
        this.state.exchangeRateInput = String(this.state.exchangeRate || 1650);
    }

    async loadDetail(productId = null) {
        const currentId = productId || this.state.productId;
        if (!currentId) {
            await this.loadDashboard();
            return;
        }
        this.state.loading = true;
        this.state.error = "";
        try {
            const data = await this.rpc("/bader_product_intelligence/data", {
                product_tmpl_id: currentId,
            });
            this.state.productId = currentId;
            this.state.viewMode = "detail";
            this.applyDetailPayload(data);
        } catch (error) {
            this.state.error = this.errorMessage(error, "No se pudo cargar el detalle del producto.");
        } finally {
            this.state.loading = false;
        }
    }

    currentProduct() {
        return (this.state.detail && this.state.detail.product) || {};
    }

    currentSeoData() {
        return (this.state.detail && this.state.detail.seoData) || {};
    }

    currentImages() {
        return (this.state.detail && this.state.detail.images) || [];
    }

    currentCompetitors() {
        return (this.state.detail && this.state.detail.competitors) || [];
    }

    currentCategories() {
        return (this.state.detail && this.state.detail.availableCategories) || [];
    }

    currentCategoryIntelligence() {
        return (this.state.detail && this.state.detail.categoryIntelligence) || null;
    }

    currentStrategy() {
        return (this.state.detail && this.state.detail.competitiveStrategy) || {};
    }

    toInput(value) {
        if (value === undefined || value === null || value === false) {
            return "";
        }
        return String(value);
    }

    parseNumber(value) {
        if (value === "" || value === null || value === undefined) {
            return 0;
        }
        return Number(value) || 0;
    }

    formatARS(value) {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
        }).format(Number(value || 0));
    }

    formatUSD(value) {
        return `USD $${Number(value || 0).toFixed(2)}`;
    }

    formatNumber(value) {
        return new Intl.NumberFormat("es-AR").format(Number(value || 0));
    }

    formatPercent(value) {
        return `${Number(value || 0).toFixed(1)}%`;
    }

    contentWordCount() {
        const text = (this.state.contentForm.description || "").trim();
        if (!text) {
            return 0;
        }
        return text.split(/\s+/).filter(Boolean).length;
    }

    contentWordCountLabel() {
        return `${this.contentWordCount()} palabras - Optimizado para SEO y motores de IA (GEO)`;
    }

    dashboardCounts() {
        const rows = this.state.dashboardRows || [];
        return {
            all: rows.filter((row) => !row.isArchived && !row.isDiscontinued).length,
            new: rows.filter((row) => !row.isPublished && !row.isArchived && !row.isDiscontinued).length,
            discontinued: rows.filter((row) => row.isArchived || row.isDiscontinued).length,
        };
    }

    filteredDashboardProducts() {
        const term = (this.state.searchTerm || "").trim().toLowerCase();
        let rows = this.state.dashboardRows || [];
        if (this.state.dashboardTab === "all") {
            rows = rows.filter((row) => !row.isArchived && !row.isDiscontinued);
        } else if (this.state.dashboardTab === "new") {
            rows = rows.filter((row) => !row.isPublished && !row.isArchived && !row.isDiscontinued);
        } else {
            rows = rows.filter((row) => row.isArchived || row.isDiscontinued);
        }
        if (!term) {
            return rows;
        }
        return rows.filter((row) => {
            return (
                (row.name || "").toLowerCase().includes(term) ||
                (row.sku || "").toLowerCase().includes(term) ||
                (row.category || "").toLowerCase().includes(term)
            );
        });
    }

    changeDashboardTab(tab) {
        this.state.dashboardTab = tab;
    }

    async syncCatalog() {
        this.state.syncBusy = true;
        try {
            const data = await this.rpc("/bader_product_intelligence/sync_catalog", {});
            this.state.dashboardRows = data.products || [];
            this.state.dashboardStats = data.stats || this.state.dashboardStats;
            this.notify("Catalogo actualizado desde Odoo.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo actualizar el catalogo."), "danger");
        } finally {
            this.state.syncBusy = false;
        }
    }

    async saveExchangeRate() {
        this.state.exchangeRateBusy = true;
        try {
            const value = this.parseNumber(this.state.exchangeRateInput) || 1650;
            const result = await this.rpc("/bader_product_intelligence/update_exchange_rate", {
                exchange_rate: value,
            });
            this.state.exchangeRate = result.exchangeRate || value;
            await this.loadDashboard();
            this.notify("Tipo de cambio actualizado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo actualizar el tipo de cambio."), "danger");
        } finally {
            this.state.exchangeRateBusy = false;
        }
    }

    async openDetail(productId) {
        this.state.origin = "dashboard";
        this.state.activeTab = "overview";
        await this.loadDetail(productId);
    }

    async goBack() {
        await this.loadDashboard();
    }

    openProductForm() {
        if (!this.state.productId) {
            return;
        }
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "product.template",
            res_id: this.state.productId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    detailMargin() {
        const product = this.currentProduct();
        const price = Number(product.priceUsd || 0);
        const cost = Number(product.costUsd || 0);
        if (!price || !cost) {
            return 0;
        }
        return ((price - cost) / price) * 100;
    }

    averageCompetitorPrice() {
        const competitors = this.currentCompetitors().filter((item) => item.competitorPrice);
        if (!competitors.length) {
            return 0;
        }
        const total = competitors.reduce((sum, item) => sum + Number(item.competitorPrice || 0), 0);
        return total / competitors.length;
    }

    priceVsCompetition() {
        const average = this.averageCompetitorPrice();
        const product = this.currentProduct();
        if (!average || !product.priceUsd) {
            return null;
        }
        return ((Number(product.priceUsd) - average) / average) * 100;
    }

    competitorPriceRange() {
        const prices = this.currentCompetitors()
            .filter((item) => item.competitorPrice)
            .map((item) => Number(item.competitorPrice || 0))
            .sort((left, right) => left - right);
        return {
            min: prices.length ? prices[0] : 0,
            max: prices.length ? prices[prices.length - 1] : 0,
        };
    }

    overviewInsights() {
        const product = this.currentProduct();
        const insights = [];
        const margin = this.detailMargin();
        const priceVs = this.priceVsCompetition();
        if (Number(product.qtyAvailable || 0) < 10) {
            insights.push({
                type: "warning",
                title: "Stock bajo",
                description: `Solo quedan ${this.formatNumber(product.qtyAvailable || 0)} unidades.`,
            });
        }
        if (margin > 40) {
            insights.push({
                type: "success",
                title: "Excelente margen",
                description: `El margen actual es ${this.formatPercent(margin)} y muestra buena rentabilidad.`,
            });
        }
        if (priceVs !== null && priceVs > 15) {
            insights.push({
                type: "warning",
                title: "Precio alto vs competencia",
                description: `El precio esta ${this.formatPercent(priceVs)} por encima del promedio de mercado.`,
            });
        }
        if (priceVs !== null && priceVs < 0) {
            insights.push({
                type: "success",
                title: "Precio competitivo",
                description: `El producto esta ${this.formatPercent(Math.abs(priceVs))} por debajo de la media.`,
            });
        }
        return insights;
    }

    analyticsInsights() {
        return this.overviewInsights();
    }

    selectTab(tabId) {
        this.state.activeTab = tabId;
    }

    updateProductField(field, value) {
        this.state.productForm[field] = value;
        if (field === "name" && !this.state.productForm.slug) {
            this.state.productForm.slug = this.generateSlug(value);
        }
    }

    generateSlug(text) {
        return (text || "")
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[-\s]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 100);
    }

    regenerateSlug(source = "name") {
        const base = source === "seo" ? this.state.seoForm.seoTitle : this.state.productForm.name;
        const slug = this.generateSlug(base);
        this.state.productForm.slug = slug;
        this.state.seoForm.slug = slug;
    }

    updateContentField(field, value) {
        this.state.contentForm[field] = value;
    }

    updateSeoField(field, value) {
        this.state.seoForm[field] = value;
        if (field === "slug") {
            this.state.productForm.slug = value;
        }
    }

    updateCategoryField(field, value) {
        this.state.categoryForm[field] = value;
    }

    toggleManualMode(ev) {
        this.state.categoryForm.manualMode = !!ev.target.checked;
    }

    toggleNiche(nicheId) {
        const current = this.state.categoryForm.niches || [];
        if (current.includes(nicheId)) {
            this.state.categoryForm.niches = current.filter((item) => item !== nicheId);
        } else {
            this.state.categoryForm.niches = [...current, nicheId];
        }
    }

    addFaq() {
        this.state.contentForm.faqs.push({ question: "", answer: "" });
    }

    updateFaq(index, field, value) {
        const current = this.state.contentForm.faqs[index] || { question: "", answer: "" };
        this.state.contentForm.faqs[index] = {
            ...current,
            [field]: value,
        };
    }

    removeFaq(index) {
        this.state.contentForm.faqs.splice(index, 1);
    }

    async saveProductData() {
        return this.rpc("/bader_product_intelligence/update_product", {
            product_tmpl_id: this.state.productId,
            values: {
                name: this.state.productForm.name,
                sku: this.state.productForm.sku,
                slug: this.state.productForm.slug,
                brand: this.state.productForm.brand,
                categoryId: this.state.productForm.categoryId || false,
                priceUsd: this.parseNumber(this.state.productForm.priceUsd),
                previousPriceUsd: this.parseNumber(this.state.productForm.previousPriceUsd),
                costUsd: this.parseNumber(this.state.productForm.costUsd),
                isPublished: !!this.state.productForm.isPublished,
                featured: !!this.state.productForm.featured,
            },
        });
    }

    async saveCategoryData() {
        return this.rpc("/bader_product_intelligence/save_category", {
            product_tmpl_id: this.state.productId,
            values: {
                manualMode: !!this.state.categoryForm.manualMode,
                niches: this.state.categoryForm.niches || [],
                type: this.state.categoryForm.type || false,
                subcategory: this.state.categoryForm.subcategory || false,
                categoryId: this.state.categoryForm.categoryId || false,
            },
        });
    }

    async saveContentData() {
        return this.rpc("/bader_product_intelligence/save_content", {
            product_tmpl_id: this.state.productId,
            values: {
                name: this.state.contentForm.name,
                description: this.state.contentForm.description,
                tone: this.state.contentForm.tone,
                audience: this.state.contentForm.audience,
                faqs: this.state.contentForm.faqs || [],
            },
        });
    }

    async saveSeoData() {
        return this.rpc("/bader_product_intelligence/save_seo", {
            product_tmpl_id: this.state.productId,
            seo_data: {
                seoTitle: this.state.seoForm.seoTitle,
                seoDescription: this.state.seoForm.seoDescription,
                seoKeywords: this.state.seoForm.seoKeywords
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                geoTitle: this.state.seoForm.geoTitle,
                geoDescription: this.state.seoForm.geoDescription,
                geoFeatures: this.state.seoForm.geoFeatures
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                geoFaq: this.state.contentForm.faqs || [],
                aiGeneratedDescription: this.state.contentForm.description,
                aiTargetAudience: this.state.contentForm.audience,
                seoScore: this.currentSeoData().seoScore || 0,
                geoScore: this.currentSeoData().geoScore || 0,
                competitivenessScore: this.currentSeoData().competitivenessScore || 0,
            },
        });
    }

    async saveAll() {
        if (!this.state.productId) {
            return;
        }
        this.state.saveBusy = true;
        try {
            await this.saveProductData();
            await this.saveCategoryData();
            await this.saveContentData();
            await this.saveSeoData();
            await this.loadDetail(this.state.productId);
            this.notify("Cambios guardados.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudieron guardar los cambios."), "danger");
        } finally {
            this.state.saveBusy = false;
        }
    }

    async analyzeSeo() {
        this.state.seoBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/analyze_seo", {
                product_tmpl_id: this.state.productId,
                target_audience: this.state.contentForm.audience || "clinicas",
            });
            this.applyDetailPayload({
                ...this.state.detail,
                seoData: result.seoData,
            });
            if (result.seoData && result.seoData.aiGeneratedDescription) {
                this.state.contentForm.description = result.seoData.aiGeneratedDescription;
            }
            this.notify("SEO optimizado con Nancy AI.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo analizar el SEO."), "danger");
        } finally {
            this.state.seoBusy = false;
        }
    }

    async saveSeoOnly() {
        this.state.seoBusy = true;
        try {
            await this.saveSeoData();
            await this.loadDetail(this.state.productId);
            this.notify("SEO guardado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo guardar el SEO."), "danger");
        } finally {
            this.state.seoBusy = false;
        }
    }

    async generateContent() {
        this.state.contentBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/generate_content", {
                product_tmpl_id: this.state.productId,
                tone: this.state.contentForm.tone,
                audience: this.state.contentForm.audience,
            });
            this.state.contentForm.name = result.name || this.state.contentForm.name;
            this.state.contentForm.description = result.description || this.state.contentForm.description;
            this.notify("Descripcion generada con Nancy AI.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo generar el contenido."), "danger");
        } finally {
            this.state.contentBusy = false;
        }
    }

    async generateFaq() {
        this.state.faqBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/generate_faq", {
                product_tmpl_id: this.state.productId,
                audience: this.state.contentForm.audience,
            });
            this.state.contentForm.faqs = (result.faqs || []).map((faq) => ({
                question: faq.question || "",
                answer: faq.answer || "",
            }));
            this.notify("FAQs generadas con Nancy AI.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudieron generar las FAQs."), "danger");
        } finally {
            this.state.faqBusy = false;
        }
    }

    async saveContentOnly() {
        this.state.contentBusy = true;
        try {
            await this.saveContentData();
            await this.loadDetail(this.state.productId);
            this.notify("Contenido guardado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo guardar el contenido."), "danger");
        } finally {
            this.state.contentBusy = false;
        }
    }

    async reclassifyCategory() {
        this.state.categoryBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/reclassify_category", {
                product_tmpl_id: this.state.productId,
            });
            this.applyDetailPayload(result);
            this.notify("Categoria reclasificada con Nancy AI.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo reclasificar el producto."), "danger");
        } finally {
            this.state.categoryBusy = false;
        }
    }

    async saveCategoryOnly() {
        this.state.categoryBusy = true;
        try {
            await this.saveCategoryData();
            await this.loadDetail(this.state.productId);
            this.notify("Categorizacion guardada.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo guardar la categorizacion."), "danger");
        } finally {
            this.state.categoryBusy = false;
        }
    }

    toggleReference(token) {
        if (this.state.imageForm.selectedReferences.includes(token)) {
            this.state.imageForm.selectedReferences = this.state.imageForm.selectedReferences.filter((item) => item !== token);
        } else {
            this.state.imageForm.selectedReferences = [...this.state.imageForm.selectedReferences, token];
        }
    }

    selectGalleryImage(url) {
        this.state.imageForm.selectedGalleryUrl = url;
    }

    async generateImage(usePro = false) {
        if (!this.state.imageForm.prompt.trim()) {
            this.notify("Escribe un prompt para generar la imagen.", "warning");
            return;
        }
        this.state.imageBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/generate_image", {
                product_tmpl_id: this.state.productId,
                prompt: this.state.imageForm.prompt,
                reference_tokens: this.state.imageForm.selectedReferences,
                style: this.state.imageForm.style,
                use_pro: !!usePro,
            });
            this.state.imageForm.generatedPreviewUrl = result.previewUrl || "";
            this.notify(usePro ? "Preview generado con Nano Banana." : "Preview generado con Nancy AI.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo generar la imagen."), "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async approveImage() {
        if (!this.state.imageForm.generatedPreviewUrl) {
            return;
        }
        this.state.imageBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/approve_image", {
                product_tmpl_id: this.state.productId,
                image_data_url: this.state.imageForm.generatedPreviewUrl,
                prompt: this.state.imageForm.prompt,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Imagen aprobada y guardada.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo guardar la imagen."), "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async addImageUrl() {
        if (!this.state.imageForm.addImageUrl.trim()) {
            return;
        }
        this.state.imageBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/add_image_url", {
                product_tmpl_id: this.state.productId,
                image_url: this.state.imageForm.addImageUrl,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Imagen agregada.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo agregar la imagen."), "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async deleteImage(imageId) {
        if (imageId === "main") {
            return;
        }
        this.state.imageBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/delete_image", {
                image_id: imageId,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Imagen eliminada.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo eliminar la imagen."), "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async saveVideo() {
        this.state.imageBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/save_video", {
                product_tmpl_id: this.state.productId,
                video_url: this.state.imageForm.videoUrl,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Video guardado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo guardar el video."), "danger");
        } finally {
            this.state.imageBusy = false;
        }
    }

    async discoverCompetitors() {
        this.state.competitorBusy = true;
        try {
            const result = await this.rpc("/bader_product_intelligence/discover_competitors", {
                product_tmpl_id: this.state.productId,
                limit: 10,
            });
            this.state.competitorForm.discoveredCompetitors = result.competitors || [];
            this.state.competitorForm.discoveryQuery = result.query || "";
            this.notify(`Se encontraron ${result.totalFound || 0} competidores.`);
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudieron descubrir competidores."), "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async addCompetitor(name = "", url = "") {
        const competitorName = name || this.state.competitorForm.competitorName;
        const competitorUrl = url || this.state.competitorForm.competitorUrl;
        if (!competitorUrl) {
            this.notify("Ingresa una URL de competidor.", "warning");
            return;
        }
        this.state.competitorBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/add_competitor", {
                product_tmpl_id: this.state.productId,
                competitor_name: competitorName,
                competitor_url: competitorUrl,
            });
            this.state.competitorForm.competitorName = "";
            this.state.competitorForm.competitorUrl = "";
            await this.loadDetail(this.state.productId);
            this.notify("Competidor agregado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo agregar el competidor."), "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async scrapeCompetitor(competitorId) {
        this.state.competitorBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/scrape_competitor", {
                competitor_id: competitorId,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Scraping completado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo scrapear el competidor."), "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async analyzeCompetitor(competitorId) {
        this.state.competitorBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/analyze_competitor", {
                competitor_id: competitorId,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Analisis competitivo actualizado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo analizar el competidor."), "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async deleteCompetitor(competitorId) {
        this.state.competitorBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/delete_competitor", {
                competitor_id: competitorId,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Competidor eliminado.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo eliminar el competidor."), "danger");
        } finally {
            this.state.competitorBusy = false;
        }
    }

    async generateStrategy() {
        this.state.strategyBusy = true;
        try {
            await this.rpc("/bader_product_intelligence/generate_strategy", {
                product_tmpl_id: this.state.productId,
            });
            await this.loadDetail(this.state.productId);
            this.notify("Estrategia competitiva generada.");
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo generar la estrategia."), "danger");
        } finally {
            this.state.strategyBusy = false;
        }
    }

    async toggleDashboardPublish(productId, checked) {
        try {
            await this.rpc("/bader_product_intelligence/update_product", {
                product_tmpl_id: productId,
                values: { isPublished: checked },
            });
            await this.loadDashboard();
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo actualizar la publicacion."), "danger");
        }
    }

    async toggleDashboardFeatured(productId, checked) {
        try {
            await this.rpc("/bader_product_intelligence/update_product", {
                product_tmpl_id: productId,
                values: { featured: checked },
            });
            await this.loadDashboard();
        } catch (error) {
            this.notify(this.errorMessage(error, "No se pudo actualizar el destacado."), "danger");
        }
    }

    quickAction(tabId) {
        this.state.activeTab = tabId;
    }

    priceMarkerStyle() {
        const range = this.competitorPriceRange();
        const price = Number(this.currentProduct().priceUsd || 0);
        if (!range.max || range.max === range.min) {
            return "left: 50%;";
        }
        const ratio = ((price - range.min) / (range.max - range.min)) * 100;
        const clamped = Math.max(0, Math.min(100, ratio));
        return `left: ${clamped}%;`;
    }
}

ProductIntelligenceAction.template = "bader_product_intelligence.ProductIntelligenceAction";

registry.category("actions").add("bader_product_intelligence.action", ProductIntelligenceAction);
