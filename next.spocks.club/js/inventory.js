"use strict";

/* ────────────────────────────────────────────────────────────────────────────
 * External deps
 * ────────────────────────────────────────────────────────────────────────── */
import Fuse from "https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.1.0/fuse.min.mjs";
import Mustache from "https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js";

import {
    debounce,
    moolah_round,
    displayInLocalTimezone,
    normalizeText,
    copyToClipboardWithFeedback,
    ajaxErrorText,
    detectDigitSeparators,
} from "./common.js";
import {
    getAllResources,
    OwnerType,
    sortResources,
} from "./prime/resources.js";
import {
    Profile
} from "./profile.js";

/* ────────────────────────────────────────────────────────────────────────────
 * Constants & configuration
 * ────────────────────────────────────────────────────────────────────────── */
const LINK_URL = "https://next.spocks.club/inventory/?category_id=";

const CLS = Object.freeze({
    selectedResource: "selected-resource",
    selectingMode: "selecting-resources-mode",
    dNone: "d-none",
    invisible: "invisible",
});

const SEL = Object.freeze({
    template: "#resource-template",
    container: "#resources",
    search: "#resource-search",
    category: "#resource-category-select",
    sort: "#resource-sort-select",
    chooseResources: "#create-new-category",
    createNew: "#create-new",
    share: "#share",
    import: "#import",
    save: "#save",
    saveUrl: "#resource-share-url",
    newCategoryName: "#new-resource-category-name",
    shareCategory: "#resource-category-share",
    renameInput: "#rename-category-input",
    renameConfirm: "#confirm-rename-category",
    renameError: "#rename-category-error",
    shareUrlBox: "#share-url-box",
    importUrlBox: "#import-url-box",
    importNameBox: "#import-name-box",
    importCategory: "#import-category",
    hideEmpty: "#hide-empty-checkbox",
    showHidden: "#show-hidden-checkbox",
    showExact: "#show-exact-checkbox",
    copyNewShareUrl: "#copy-new-share-url",
    copyShareUrl: "#copy-share-url",
    inventoryExport: "#inventory-export",
    categoryToolsDropdown: "#category-tools-dropdown",
    categoryMgmtBtn: "#category-management-btn",
    categoryMgmtList: "#category-management-list",
    categoryMgmtItemTemplate: "#category-management-item-template",
    renameCategoryModal: "#renameCategoryModal",
    categoryManagementModal: "#categoryManagementModal",
    deleteCategoryModal: "#deleteCategoryModal",
    shareModal: "#shareModal",
    deleteName: "#delete-category-name",
    editCategoryBanner: "#edit-category-banner",
    updateCategory: "#update-category",
    cancelEditCategory: "#cancel-edit-category",
    lastUpdated: "#last-updated",
    resourceBoxes: ".resource-box",
    resourceInfoIcon: ".resource-info-icon",
    formatNumSpans: "#resources span.format-num",
    shareCategoryOption: "#share-category-option",
    confirmDeleteCategory: "#confirm-delete-category",
    renameCategoryBtn: "#rename-category",
});

const SEL_ALERTS = Object.freeze({
    modal: "#alertsOverviewModal",
    list: "#alerts-overview-list",
    loading: "#alerts-overview-loading",
    empty: "#alerts-overview-empty",
    itemTemplate: "#alerts-overview-item-template",
});

const ACTIONS = Object.freeze({
    GET_CUSTOM_CATEGORIES: 45,
    SAVE_RESOURCE_CATEGORY: 44,
    LOAD_CATEGORY_BY_LINK: 46,
    RENAME_CATEGORY: 48,
    DELETE_CATEGORY: 47,
    UPDATE_RESOURCE_CATEGORY: 49,
    LAST_SYNC_TIME: 71,
});

const ALERT_ACTIONS = Object.freeze({
    CREATE: 50,
    LIST: 51,
    DELETE: 52,
    ACK: 53,
});

/* ────────────────────────────────────────────────────────────────────────────
 * Tiny utilities
 * ────────────────────────────────────────────────────────────────────────── */
// Safe int parse across UIs
const toInt = (v) => {
    const n = Number.parseInt(String(v ?? "").replace(/[,_\s]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
};

const isJQuery = (obj) => {
    // All jQuery objects have an attribute that contains the jQuery version.
    return typeof obj === "object" && obj != null && obj.jquery != null;
};

const asInt = (ref) => {
    // Normalize to a jQuery object
    const $el = typeof ref === 'string' ?
        $(ref.startsWith('#') || ref.startsWith('.') ? ref : `#${ref}`) :
        (isJQuery(ref) ? ref : $(ref));

    const node = $el[0];
    if (!node) return 0;

    // Prefer AutoNumeric instance if present
    const an = AutoNumeric.getAutoNumericElement(node);
    if (an) return an.getNumber();

    // Fallback to plain value
    return toInt($el.val() ? ? 0);
};

const setInt = (s, v) => {
    let el = null;

    if (isJQuery(s) && s.length === 1) {
        el = AutoNumeric.getAutoNumericElement(s[0]);
    } else {
        el = AutoNumeric.getAutoNumericElement(s);
    }

    if (el === null) {
        return $(s).val(v);
    } else {
        return el.set(v);
    }
};

const setDisabled = ($el, on) => $el.prop("disabled", !!on);
const toggleClassList = (el, cls, on) => el && el.classList.toggle(cls, !!on);
const setText = (selOrEl, text) => {
    const el =
        selOrEl instanceof Element ? selOrEl : document.querySelector(selOrEl);
    if (el) el.textContent = String(text ? ? "");
};
const valStr = ($el) => String($el.val() ? ? "").trim();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function enableInlineRename($card) {
    const $titleSpan = $card.find("[data-bundle-title]");
    if (!$titleSpan.length) return;

    if ($card.find(".bundle-title-input").length) return;

    const current = ($titleSpan.text() || "").trim();
    const $input = $('<input type="text" class="form-control form-control-sm bundle-title-input" />')
        .val(current)
        .attr("maxlength", 80);

    const commit = (save) => {
        const next = String($input.val() || "").trim();
        if (save && next) $titleSpan.text(next.slice(0, 80));
        $input.remove();
        $titleSpan.removeClass("d-none");
    };

    $titleSpan.addClass("d-none");
    $input.insertAfter($titleSpan).trigger("focus").select();

    $input.on("keydown", (e) => {
        if (e.key === "Enter") commit(true);
        else if (e.key === "Escape") commit(false);
    });

    $input.on("blur", () => commit(true));
}


const fmtInt = (n) => {
    const x = Math.max(0, Math.floor(n || 0));
    return x < 1000000 ?
        x.toLocaleString(undefined, {
            style: "decimal",
            maximumFractionDigits: 0,
            useGrouping: true,
        }) :
        moolah_round(n).replaceAll(" ", " ");
};

const parseDateTime = (s) => {
    if (!s || typeof s !== "string") return null;
    const d = new Date(s.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
};
const hoursSince = (date) =>
    !date ? Infinity : (Date.now() - date.getTime()) / 36e5;
const percentToGoal = (current, goal) =>
    !goal || goal <= 0 ? null : Math.min(100, Math.floor((current / goal) * 100));

/* ────────────────────────────────────────────────────────────────────────────
 * API wrapper
 * ────────────────────────────────────────────────────────────────────────── */
const api = {
    /** @template T @param {number} action @param {Record<string, any>} payload */
    post(action, payload = {}) {
        return $.ajax({
            url: "/ajax.php",
            method: "POST",
            dataType: "json",
            data: {
                a: action,
                ...payload
            },
        });
    },
    j(payloadObj) {
        // deterministic JSON string (keeps your server happy)
        return JSON.stringify(payloadObj);
    },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Central state & DOM cache
 * ────────────────────────────────────────────────────────────────────────── */
const state = {
    ui: {
        templateHtml: ""
    },
    filters: {
        sort: "default",
        search: "",
        hideEmpty: false,
        showHidden: true,
        showExact: false,
    },
    category: {
        currentId: "all",
        creationMode: false,
        editMode: false,
        editingId: /** @type {string|null} */ (null),
        newName: "",
        selectedResourceIds: /** @type {number[]} */ ([]),
        cachedCustom:
            /** @type {Array<{id:string,name:string,link:string,filter:(r:any)=>boolean}>} */
            ([]),
    },
    user: {
        isLoggedIn: false,
        resourcesById: new Map()
    },
    resources: {
        byId: new Map(),
        list: /** @type {any[]} */ ([]),
        fuse: /** @type {Fuse<any>|null} */ (null),
        currentView: /** @type {any[]} */ ([]),
    },
    preview: {
        id: /** @type {string|null} */ (null),
        name: /** @type {string|null} */ (null),
        importedResourceIds: /** @type {number[]} */ ([]),
    },
};

const DOM = {
    $container: $(SEL.container),
    $template: $(SEL.template),
    $search: $(SEL.search),
    $category: $(SEL.category),
    $sort: $(SEL.sort),
    $chooseResources: $(SEL.chooseResources),
    $createNew: $(SEL.createNew),
    $share: $(SEL.share),
    $import: $(SEL.import),
    $save: $(SEL.save),
    $saveUrl: $(SEL.saveUrl),
    $newCategoryName: $(SEL.newCategoryName),
    $shareCategory: $(SEL.shareCategory),
    $renameInput: $(SEL.renameInput),
    $renameConfirm: $(SEL.renameConfirm),
    $renameError: $(SEL.renameError),
    $shareUrlBox: $(SEL.shareUrlBox),
    $importUrlBox: $(SEL.importUrlBox),
    $importNameBox: $(SEL.importNameBox),
    $importCategory: $(SEL.importCategory),
    $hideEmpty: $(SEL.hideEmpty),
    $showHidden: $(SEL.showHidden),
    $showExact: $(SEL.showExact),
    $copyNewShareUrl: $(SEL.copyNewShareUrl),
    $copyShareUrl: $(SEL.copyShareUrl),
    $inventoryExport: $(SEL.inventoryExport),
    $categoryToolsDropdown: $(SEL.categoryToolsDropdown),
    $categoryMgmtBtn: $(SEL.categoryMgmtBtn),
    $categoryMgmtList: $(SEL.categoryMgmtList),
    $categoryMgmtItemTemplate: $(SEL.categoryMgmtItemTemplate),
    $renameCategoryModal: $(SEL.renameCategoryModal),
    $categoryManagementModal: $(SEL.categoryManagementModal),
    $deleteCategoryModal: $(SEL.deleteCategoryModal),
    $shareModal: $(SEL.shareModal),
    $deleteName: $(SEL.deleteName),
    $editCategoryBanner: $(SEL.editCategoryBanner),
    $updateCategory: $(SEL.updateCategory),
    $cancelEditCategory: $(SEL.cancelEditCategory),
    $lastUpdated: $(SEL.lastUpdated),
};

/* ────────────────────────────────────────────────────────────────────────────
 * Modules
 * ────────────────────────────────────────────────────────────────────────── */
const Resources = {
    async load() {
        const all = await Array.fromAsync(getAllResources());
        const filtered = all.filter(
            (r) =>
            r.owner_type !== OwnerType.Alliance &&
            r.name !== "Missing Translation" &&
            r.name !== "Mission Token" &&
            r.id !== 982245154
        );

        state.resources.list = filtered.map((r) => ({
            ...r,
            nameNormalized: normalizeText(r.name).toLowerCase(),
        }));

        state.resources.byId.clear();
        for (const r of state.resources.list) state.resources.byId.set(r.id, r);

        state.resources.fuse = new Fuse(state.resources.list, {
            keys: ["nameNormalized"],
            threshold: 0.3,
            includeScore: true,
            shouldSort: true,
        });
    },

    filterByCategory(categoryId) {
        const all = state.resources.list;
        if (categoryId === "all") return all;
        if (categoryId === "directives")
            return all.filter((r) => r.name.toLowerCase().includes("directive"));
        if (categoryId === "artifacts")
            return all.filter((r) =>
                r.id_str ? .startsWith("Resource_Artifact_Pieces")
            );
        const custom = state.category.cachedCustom.find((c) => c.id === categoryId);
        return custom ? all.filter(custom.filter) : [];
    },

    computeView() {
        const {
            hideEmpty,
            showHidden,
            search
        } = state.filters;
        let base = state.resources.list;

        // apply search first, against full list
        if (search && state.resources.fuse) {
            const scored = new Map(
                state.resources.fuse
                .search(search)
                .map(({
                    item,
                    score
                }) => [item.id, score])
            );
            base = base
                .filter(({
                    id
                }) => scored.has(id))
                .toSorted((a, b) => (scored.get(a.id) ? ? 0) - (scored.get(b.id) ? ? 0));
        }

        // then apply category filter on that result
        let view = Resources.filterByCategory(state.category.currentId).filter(
            (r) => base.includes(r)
        );

        if (hideEmpty)
            view = view.filter(
                ({
                    id
                }) => (state.user.resourcesById.get(id) ? ? 0) > 0
            );
        if (!showHidden)
            view = view.filter(
                ({
                    show_in_inventory_rule
                }) => show_in_inventory_rule !== 1
            );

        const sort = state.filters.sort;
        if (sort === "alphabetical")
            view.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === "quantity")
            view.sort(
                (a, b) =>
                (state.user.resourcesById.get(b.id) ? ? 0) -
                (state.user.resourcesById.get(a.id) ? ? 0)
            );

        return view;
    },

    render() {
        const tpl = state.ui.templateHtml;
        if (!tpl) return;

        const showExact = state.filters.showExact;
        const html = state.resources.currentView
            .map((resource) => {
                const amount = state.user.resourcesById.get(resource.id) ? ? 0;
                const formattedAmount = showExact ?
                    fmtInt(amount) :
                    moolah_round(amount);
                const isSelected = state.category.selectedResourceIds.includes(
                    resource.id
                );
                return Mustache.render(tpl, {
                    resource,
                    klass: isSelected ? ` ${CLS.selectedResource}` : "",
                    amount,
                    formattedAmount,
                });
            })
            .join("");

        // Batch replace to avoid incremental layout
        DOM.$container.html(html);
    },

    rerender() {
        state.resources.currentView = Resources.computeView();
        Resources.render();
    },
};

const User = {
    async load() {
        const profile = new Profile();
        if (!profile.isLoggedIn()) {
            state.user.isLoggedIn = false;
            disableTopControls(true);
            return false;
        }

        state.user.isLoggedIn = true;
        const userData = await profile.loadSettings({
            type: "resource",
            qualifier: null,
            id: -1,
        });

        state.user.resourcesById.clear();
        userData ? .resource ? .forEach((ur) =>
            state.user.resourcesById.set(ur.id, ur.amount)
        );

        // Alerts are advisory; failure shouldn't block UI
        fetchDisplayAlerts().catch(() => {});

        // Last sync time (best-effort)
        try {
            const sync = await api.post(ACTIONS.LAST_SYNC_TIME);
            if (sync ? .status === 1 && DOM.$lastUpdated.length) {
                DOM.$lastUpdated.text(
                    `Updated: ${displayInLocalTimezone(sync.last_sync_time, true)}`
                );
            }
        } catch {}
        return true;
    },
};

function disableTopControls(on) {
    setDisabled(DOM.$category, on);
    setDisabled(DOM.$createNew, on);
    setDisabled(DOM.$share, on);
    setDisabled(DOM.$import, on);
    setDisabled(DOM.$sort, on);
}

const Categories = {
    async fetchCustom() {
        try {
            /** @type {Record<string,{name:string,shareable_link_uuid:string,resource_ids:number[]}>} */
            const data = await api.post(ACTIONS.GET_CUSTOM_CATEGORIES);
            state.category.cachedCustom = Object.keys(data).map((key) => {
                const row = data[key];
                const set = new Set(row.resource_ids); // speed up filter predicate
                return {
                    id: `custom-${key}`,
                    name: row.name,
                    link: row.shareable_link_uuid,
                    filter: (r) => set.has(r.id),
                };
            });
        } catch (e) {
            console.error("Failed to fetch custom categories:", e);
            state.category.cachedCustom = [];
        }
    },

    populateSelectors() {
        // Main select
        DOM.$category.find("option[value^='custom-']").remove();
        for (const c of state.category.cachedCustom)
            DOM.$category.append(new Option(c.name, c.id));

        // Share selector
        DOM.$shareCategory.empty().append(new Option("Select a category…", ""));
        for (const c of state.category.cachedCustom)
            DOM.$shareCategory.append(new Option(c.name, c.link));
    },

    setSelectingMode(on) {
        toggleClassList(document.body, CLS.selectingMode, on);
    },

    startCreate() {
        state.category.creationMode = true;
        state.category.editMode = false;
        state.category.editingId = null;

        disableTopControls(true);
        DOM.$save.removeClass(CLS.dNone);
        Categories.reflectSaveButtonState();
        DOM.$updateCategory.addClass(CLS.dNone);
        DOM.$cancelEditCategory.addClass(CLS.dNone);
        Categories.setSelectingMode(true);
    },

    stopCreate() {
        state.category.creationMode = false;
        disableTopControls(false);
        DOM.$save.addClass(CLS.dNone);
        setDisabled(DOM.$save, true);
        Categories.setSelectingMode(false);
    },

    startEdit(categoryId) {
        state.category.editMode = true;
        state.category.creationMode = false;
        state.category.editingId = categoryId;

        disableTopControls(true);
        DOM.$createNew.addClass(CLS.dNone);
        DOM.$import.addClass(CLS.dNone);
        DOM.$updateCategory.removeClass(CLS.dNone);
        DOM.$cancelEditCategory.removeClass(CLS.dNone);
        DOM.$categoryMgmtBtn.addClass(CLS.dNone);
        Categories.setSelectingMode(true);

        const custom = state.category.cachedCustom.find((c) => c.id === categoryId);
        if (custom) {
            state.category.selectedResourceIds = Resources.filterByCategory(
                categoryId
            ).map((r) => r.id);
            Categories.updateEditBanner(
                custom.name,
                state.category.selectedResourceIds.length
            );
        } else {
            DOM.$editCategoryBanner.hide();
        }

        // Show all during edit
        state.category.currentId = "all";
        Resources.rerender();
    },

    stopEdit() {
        state.category.editMode = false;
        state.category.editingId = null;

        disableTopControls(false);
        DOM.$createNew.removeClass(CLS.dNone);
        DOM.$import.removeClass(CLS.dNone);
        DOM.$updateCategory.addClass(CLS.dNone);
        DOM.$cancelEditCategory.addClass(CLS.dNone);
        if (state.category.currentId === "all")
            DOM.$categoryMgmtBtn.removeClass(CLS.dNone);

        state.category.selectedResourceIds.length = 0;
        Categories.setSelectingMode(false);
        DOM.$editCategoryBanner.hide();
        Resources.rerender();
    },

    updateEditBanner(name, count) {
        DOM.$editCategoryBanner
            .html(
                `Editing <strong>${name}</strong> &mdash; <strong>${count}</strong> resources selected`
            )
            .show();
    },

    saveNew(name, ids) {
        return api.post(ACTIONS.SAVE_RESOURCE_CATEGORY, {
            name,
            resource_ids: api.j(ids),
        });
    },
    updateByLink(link, ids) {
        return api.post(ACTIONS.UPDATE_RESOURCE_CATEGORY, {
            link,
            resource_ids: api.j(ids),
        });
    },
    renameByLink(link, new_name) {
        return api.post(ACTIONS.RENAME_CATEGORY, {
            link,
            new_name
        });
    },
    deleteByLink(link) {
        return api.post(ACTIONS.DELETE_CATEGORY, {
            link
        });
    },
    loadPreviewByLink(link) {
        return api.post(ACTIONS.LOAD_CATEGORY_BY_LINK, {
            link
        });
    },

    isCustomSelected() {
        const id = state.category.currentId;
        return state.category.cachedCustom.some((c) => c.id === id);
    },

    reflectMgmtButton() {
        if (Categories.isCustomSelected()) DOM.$categoryMgmtBtn.hide();
        else DOM.$categoryMgmtBtn.show();
    },

    reflectSaveButtonState() {
        const hasSelection = state.category.selectedResourceIds.length > 0;
        setDisabled(DOM.$save, !hasSelection);
    },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Alerts
 * ────────────────────────────────────────────────────────────────────────── */
const ALERT_COOLDOWN_HOURS = 12;

function evaluateAlerts(
    alerts,
    resourcesById,
    cooldownHours = ALERT_COOLDOWN_HOURS
) {
    const hits = [];
    for (const a of alerts) {
        const rid = Number(a.resource_id);
        const current = Number(resourcesById.get(rid) ? ? 0);
        const lastAck = parseDateTime(a.last_acknowledged_at);
        if (hoursSince(lastAck) < cooldownHours) continue;

        let triggered = false;
        let reason = "";

        if (a.alert_type === "upgrade") {
            const amt =
                a.threshold_amount != null ? Number(a.threshold_amount) : null; // reference
            const pct = a.target_percent != null ? Number(a.target_percent) : null; // threshold %

            if (amt != null && amt > 0 && pct != null && pct >= 1) {
                const nowPct = percentToGoal(current, amt); // 0..∞
                if (nowPct != null && nowPct >= pct) {
                    triggered = true;
                    const triggerUnits = Math.ceil(amt * (pct / 100));
                    reason = `≥ ${fmtInt(triggerUnits)} (${pct}% of ${fmtInt(amt)})`;
                }
            }
        } else {
            // refinery
            const amt =
                a.threshold_amount != null ? Number(a.threshold_amount) : null;
            if (amt != null && a.direction === "lt" && current < amt) {
                triggered = true;
                reason = `below ${fmtInt(amt)}`;
            } else {
                const daily = Number(a.daily_decay || 0);
                const days = a.days_to_sustain != null ? Number(a.days_to_sustain) : 0;
                if (daily > 0 && days > 0) {
                    const need = daily * days;
                    if (current < need) {
                        triggered = true;
                        reason = `insufficient for ${days}d (need ${fmtInt(need)})`;
                    }
                }
            }
        }

        if (triggered) {
            const hit = {
                id: Number(a.id),
                name: String(a.name ? ? ""),
                alert_type: String(a.alert_type),
                resource_id: rid,
                direction: String(a.direction || ""),
                threshold_amount: a.threshold_amount != null ? Number(a.threshold_amount) : null,
                target_percent: a.target_percent != null ? Number(a.target_percent) : null,
                daily_decay: a.daily_decay != null ? Number(a.daily_decay) : 0,
                days_to_sustain: a.days_to_sustain != null ? Number(a.days_to_sustain) : null,
                current_amount: current,
                reason,
            };
            const ptg = percentToGoal(current, hit.threshold_amount);
            if (ptg != null) hit.percent_to_goal = ptg;
            hits.push(hit);
        }
    }
    return hits;
}

const snoozeKey = (id) => `uia_snooze_${id}`;
const isSnoozed = (id) => {
    const v = localStorage.getItem(snoozeKey(id));
    const till = v ? Number(v) : NaN;
    return Number.isFinite(till) && Date.now() < till;
};
const setSnooze = (id, hours) =>
    localStorage.setItem(snoozeKey(id), String(Date.now() + hours * 3600 * 1000));
const clearSnooze = (id) => localStorage.removeItem(snoozeKey(id));

function showFeedbackToast(title, message, type = "success") {
    const $wrap = $("#alerts-toast-container");
    const html = `
    <div class="toast text-bg-${type}" role="alert" data-bs-delay="10000">
      <div class="toast-header">
        <i class="fa-light fa-bell-ring me-2"></i>
         <strong class="me-auto">${title ?? "Inventory Alert"}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${message}</div>
    </div>`;
    const $el = $(html).appendTo($wrap);
    const toast = bootstrap.Toast.getOrCreateInstance($el[0]);
    toast.show();
}

function formatHitRow(hit) {
    const isRefinery = hit.alert_type === "refinery";
    const typeLabel = isRefinery ? "Refinery" : "Upgrade";
    const typeClass = isRefinery ? "text-bg-info" : "text-bg-primary";

    let details = hit.reason || "";

    if (isRefinery) {
        // Only compute refinery text if we don't already have a reason
        if (!details) {
            if (hit.threshold_amount != null) {
                details = `below ${fmtInt(hit.threshold_amount)}`;
            } else if (hit.daily_decay && hit.days_to_sustain) {
                details = `insufficient for ${hit.days_to_sustain}d`;
            }
        }
    } else {
        // Upgrade
        const amt =
            hit.threshold_amount != null ? Number(hit.threshold_amount) : null;
        const pct = hit.target_percent != null ? Number(hit.target_percent) : null;

        if (amt && pct) {
            const triggerUnits = Math.ceil(amt * (pct / 100));
            details = `≥ ${fmtInt(triggerUnits)} (${pct}% of ${fmtInt(amt)})`;
        } else if (!details) {
            // Only fall back to this if there isn't already a reason
            details = "No threshold set";
        }
    }

    return {
        typeLabel,
        typeClass,
        details
    };
}

function ackInventoryAlerts(ids) {
    return api.post(ALERT_ACTIONS.ACK, {
        json: api.j({
            ids
        })
    });
}

function renderAlertToasts(hits) {
    const $wrap = $("#alerts-toast-container");
    const tmpl = $("#alert-toast-template").html();
    if (!tmpl || !$wrap.length) return;

    // Clear previous alerts rendered by us
    $wrap.find(".toast[data-alert-id]").remove();

    for (const hit of hits) {
        if (isSnoozed(hit.id)) continue;

        const res = state.resources.byId.get(hit.resource_id);
        const imgSrc = res ? .art_id ?
            `/assets/prime/resources/${res.art_id}.png` :
            `/assets/prime/resources/placeholder.png`;

        const {
            typeLabel,
            typeClass,
            details
        } = formatHitRow(hit);
        const html = Mustache.render(tmpl, {
            ...hit,
            typeLabel,
            typeClass,
            details,
            resourceName: res ? .name || `#${hit.resource_id}`,
            currentAmount: fmtInt(hit.current_amount ? ? 0),
            imgSrc,
        });

        const $el = $(html).appendTo($wrap);
        const toast = bootstrap.Toast.getOrCreateInstance($el[0], {
            autohide: false,
        });
        toast.show();
    }
}

async function fetchUserAlerts() {
    const profile = new Profile();
    try {
        const raw = await profile.loadSettings({
            type: "inventory_alerts",
            qualifier: null,
            id: -1,
        });
        const rows = Array.isArray(raw) ?
            raw :
            Array.isArray(raw ? .inventory_alerts) ?
            raw.inventory_alerts :
            [];
        return rows.map((r) => ({
            id: Number(r.id),
            name: String(r.name ? ? ""),
            alert_type: String(r.alert_type ? ? ""),
            direction: String(r.direction ? ? ""),
            resource_id: Number(r.resource_id ? ? 0),
            threshold_amount: r.threshold_amount != null ? Number(r.threshold_amount) : null,
            target_percent: r.target_percent != null ? Number(r.target_percent) : null,
            daily_decay: r.daily_decay != null ? Number(r.daily_decay) : 0,
            days_to_sustain: r.days_to_sustain != null ? Number(r.days_to_sustain) : null,
            days_in_advance: r.days_in_advance != null ? Number(r.days_in_advance) : 0,
            last_acknowledged_at: r.last_acknowledged_at ? ? null,
            created_at: r.created_at ? ? null,
            updated_at: r.updated_at ? ? null,
        }));
    } catch (err) {
        console.error("fetchUserAlerts failed:", err);
        return [];
    }
}

async function fetchDisplayAlerts() {
    try {
        const alerts = await fetchUserAlerts();
        const hits = evaluateAlerts(
            alerts,
            state.user.resourcesById,
            ALERT_COOLDOWN_HOURS
        );
        renderAlertToasts(hits);
    } catch (e) {
        console.warn("Client alert eval failed:", e);
    }
}

function formatAlertRow(model) {
    const isRefinery = model.alert_type === "refinery";
    const typeLabel = isRefinery ? "Refinery" : "Upgrade";
    const typeClass = isRefinery ? "text-bg-info" : "text-bg-primary";

    let details = "";
    if (isRefinery) {
        if (model.threshold_amount != null)
            details = `below ${moolah_round(model.threshold_amount)}`;
        else {
            const dd = fmtInt(model.daily_decay || 0);
            const dts =
                model.days_to_sustain != null ? ` × ${model.days_to_sustain}d` : "";
            details = `usage ${dd}${dts}`;
        }
    } else {
        // upgrade
        const amt =
            model.threshold_amount != null ? Number(model.threshold_amount) : null;
        const pct =
            model.target_percent != null ? Number(model.target_percent) : null;
        if (amt && pct) {
            const triggerUnits = Math.ceil(amt * (pct / 100));
            details = `≥ ${moolah_round(triggerUnits)} (${pct}% of ${moolah_round(
        amt
      )})`;
        } else {
            details = "No threshold set";
        }
    }
    return {
        typeLabel,
        typeClass,
        details
    };
}

function summarizeAlert(model) {
    const res = state.resources.byId.get(model.resource_id);
    const icon = res ? .art_id ?
        `/assets/prime/resources/${res.art_id}.png` :
        `/assets/prime/resources/placeholder.png`;
    const name = res ? .name || `#${model.resource_id}`;
    const now = Number(state.user.resourcesById.get(model.resource_id) ? ? 0);

    const isRef = model.alert_type === "refinery";
    let conditionLine = "";
    let statusLine = "";
    let projectionLine = "";
    let whyNotTriggered = "";

    if (isRef) {
        const amt =
            model.threshold_amount != null ? Number(model.threshold_amount) : null;
        const daily = Number(model.daily_decay || 0);
        const daysConf =
            model.days_to_sustain != null ? Number(model.days_to_sustain) : 0;

        if (amt != null) {
            // Condition: below fixed threshold
            conditionLine = `below ${moolah_round(amt)}`;

            statusLine = `Holding ${fmtInt(now)} vs threshold ${moolah_round(amt)}.`;
            if (now >= amt) {
                const daysCanSustain = daily > 0 ? Math.floor(now / daily) : 0;
                const daysAboveThreshold = daily > 0 ? Math.floor((now - amt) / daily) : 0;
                whyNotTriggered = `Not triggered: Current amount ≥ threshold, enough to sustain the refinery for ${fmtInt(daysCanSustain)} more day${daysCanSustain === 1 ? "" : "s"} (${fmtInt(daysAboveThreshold)} day${daysAboveThreshold === 1 ? "" : "s"} above threshold)`;
                if (daily > 0) {
                    const daysUntil = Math.max(0, Math.ceil((now - amt) / daily));
                    projectionLine = `At ${fmtInt(
            daily
          )}/day you’ll reach threshold in ~${fmtInt(daysUntil)} day${
            daysUntil === 1 ? "" : "s"
          }.`;
                }
            } else {
                whyNotTriggered = `This alert would trigger now (below threshold).`;
            }
        } else if (daily > 0 && daysConf > 0) {
            // Condition: sustainability window
            const need = daily * daysConf;
            conditionLine = `insufficient for ${daysConf}d (need ${moolah_round(
        need
      )})`;

            const daysYouCanSustain = Math.floor(now / daily);
            statusLine = `Usage ${fmtInt(daily)}/day; you can sustain ~${fmtInt(
        daysYouCanSustain
      )} day${daysYouCanSustain === 1 ? "" : "s"}.`;
            if (now >= need) {
                whyNotTriggered = `Not triggered: you can still sustain the configured ${daysConf} day${
          daysConf === 1 ? "" : "s"
        }.`;
            } else {
                whyNotTriggered = `This alert would trigger now (cannot sustain ${daysConf}d).`;
            }
            projectionLine = `Needs ${moolah_round(
        need
      )} total to sustain ${daysConf} day${daysConf === 1 ? "" : "s"}.`;
        } else {
            conditionLine = "Refinery threshold not fully specified";
        }
    } else {
        // Upgrade
        const amt =
            model.threshold_amount != null ? Number(model.threshold_amount) : null; // reference
        const pct =
            model.target_percent != null ? Number(model.target_percent) : null; // %
        if (amt && pct) {
            const triggerUnits = Math.ceil(amt * (pct / 100));
            const progPct = percentToGoal(now, triggerUnits) ? ? 0;
            conditionLine = `≥ ${moolah_round(
        triggerUnits
      )} (${pct}% of ${moolah_round(amt)})`;
            statusLine = `Progress: ${fmtInt(now)} / ${moolah_round(
        triggerUnits
      )} (${progPct}%).`;
            whyNotTriggered =
                now >= triggerUnits ?
                "This alert would trigger now (meets threshold)." :
                "Not triggered: progress below threshold.";
            // no projection without a known accrual rate
        } else {
            conditionLine = "No threshold set";
        }
    }

    const lastAck = model.last_acknowledged_at ?
        displayInLocalTimezone(model.last_acknowledged_at, true) :
        null;

    const {
        typeLabel,
        typeClass
    } = formatAlertRow(model);

    return {
        id: model.id,
        typeLabel,
        typeClass,
        imgSrc: icon,
        resourceName: name,
        displayName: model.name || "Unnamed Alert",
        currentAmount: fmtInt(now),
        conditionLine,
        statusLine,
        projectionLine,
        whyNotTriggered,
        createdAt: model.created_at ?
            displayInLocalTimezone(model.created_at, true) :
            null,
        lastAck,
    };
}

function renderAlertsList(alerts) {
    const $list = $(SEL_ALERTS.list);
    const $empty = $(SEL_ALERTS.empty);
    const tmpl = $(SEL_ALERTS.itemTemplate).html();

    $list.empty();
    if (!Array.isArray(alerts) || alerts.length === 0) {
        $empty.show();
        return;
    }

    $empty.hide();
    const html = alerts
        .map((a) => {
            const view = summarizeAlert(a);
            return Mustache.render(tmpl, view);
        })
        .join("");

    $list.html(html);
}

async function loadAlertsIntoModal() {
    const $loading = $(SEL_ALERTS.loading);
    const $list = $(SEL_ALERTS.list);
    const $empty = $(SEL_ALERTS.empty);

    $list.empty();
    $empty.hide();
    $loading.show().addClass("d-flex");

    try {
        const alerts = await fetchUserAlerts();
        renderAlertsList(alerts);
    } catch (e) {
        console.error(e);
        $list.empty();
        $empty.text("Failed to load alerts.").show();
    } finally {
        $loading.hide().removeClass("d-flex");
    }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Inventory Alert Modal (refinery / upgrade)
 * ────────────────────────────────────────────────────────────────────────── */
export const InventoryAlertModal = (() => {
    let alertType = "refinery"; // "refinery" | "upgrade"
    const el = document.getElementById("inventoryAlertModal");
    const bsModal = el ?
        bootstrap.Modal.getOrCreateInstance(el, {
            backdrop: true
        }) :
        null;
    const q = (id) => document.getElementById(id);

    const advancedSwitch = q("ias-advanced-mode");
    const simpleWrap = q("ias-simple-mode");
    const advancedWrap = q("ias-advanced-mode-wrap");
    const addBundleBtn = q("ias-add-bundle");
    const bundlesWrap = q("ias-bundles");
    const bundleTemplate = q("ias-bundle-template");

    const sustainDaysSimple = q("ias-sustain-days");
    const dailyDecayInput = q("ias-daily-decay");
    const sustainDaysAdv = q("ias-sustain-days-adv");

    const refineryPreview = q("ias-refinery-preview");
    const prevTotalNeeded = q("ias-preview-total-needed");

    const upgradeTargetInput = q("ias-target-amount");
    const upgradePreview = q("ias-upgrade-preview");
    const prevUpgradeThreshold = q("ias-upgrade-preview-threshold");

    const targetPercentInput = q("ias-target-percent");
    const prevUpgradeRef = q("ias-upgrade-preview-ref");
    const percentBadge = q("ias-upgrade-preview-percent");

    const createBtn = q("ias-create-alert");

    function calcRefineryModel() {
        const adv = !!advancedSwitch ? .checked;

        if (!adv) {
            const days = Math.max(0, toInt(sustainDaysSimple ? .value));
            const daily = Math.max(0, asInt(dailyDecayInput));
            const totalNeeded = Math.ceil(daily * days);
            return {
                mode: "simple",
                days,
                totalDaily: daily,
                bundles: [],
                totalNeeded,
            };
        }

        const days = Math.max(0, toInt(sustainDaysAdv ? .value));
        const bundles = getBundles()
            .map((b, i) => {
                const cost = Math.max(0, Number(b.cost || 0));
                const cooldown = Math.max(1, Number(b.cooldown || 1));
                const perDay = cost / cooldown;
                return {
                    idx: i + 1,
                    name: b.name || `Bundle ${i + 1}`,
                    cost,
                    cooldown,
                    perDay,
                };
            })
            .filter((b) => b.cost > 0);

        const totalDaily = bundles.reduce((s, b) => s + b.perDay, 0);
        const totalNeeded = Math.ceil(totalDaily * days);
        return {
            mode: "advanced",
            days,
            bundles,
            totalDaily,
            totalNeeded
        };
    }

    const getBundles = () =>
        $(".card", $(bundlesWrap))
        .map(function(i, card) {
            const $c = $(card);
            const name = (
                $c.find("[data-bundle-title]").text() || `Bundle ${i + 1}`
            ).trim();
            const cost = asInt($c.find('input[data-field="cost"]'));
            const cooldown = Math.max(
                1,
                toInt($c.find('input[data-field="cooldown"]').val() ? ? 1)
            );
            return {
                id: String($c.data("id") || i + 1),
                name,
                cost,
                cooldown
            };
        })
        .get();

    const calcRefineryNeeded = () => {
        const adv = !!advancedSwitch ? .checked;
        const days = adv ?
            toInt(sustainDaysAdv ? .value) :
            toInt(sustainDaysSimple ? .value);
        if (days <= 0) return 0;

        if (!adv) {
            const dailyDecay = Math.max(0, asInt(dailyDecayInput));
            return Math.ceil(dailyDecay * days);
        }
        const bundles = getBundles();
        const total = bundles.reduce(
            (sum, b) => sum + (b.cost / Math.max(1, b.cooldown)) * days,
            0
        );
        return Math.ceil(total);
    };

    const reflectRemoveButtons = () => {
        const $cards = $(".card", $(bundlesWrap));
        const multiple = $cards.length > 1;
        $cards.each(function() {
            $(this)
                .find('[data-action="remove-bundle"]')
                .toggleClass(CLS.invisible, !multiple);
        });
    };

    const addBundle = () => {
        const $tpl = $($(bundleTemplate).html());
        const count = $(".card", $(bundlesWrap)).length + 1;
        $tpl.data("id", String(Date.now()));
        $tpl.find("[data-bundle-title]").text(`Bundle ${count}`);
        $tpl.find("input[data-field]").on("input", refreshUI);
        $tpl.find('[data-action="remove-bundle"]').on("click", () => {
            $tpl.remove();
            reflectRemoveButtons();
            refreshUI();
        });
        $tpl.find('[data-action="edit-bundle-name"]').on("click", (e) => {
            e.preventDefault();
            enableInlineRename($tpl);
        });
        $tpl.find("[data-bundle-title]").on("click", () => enableInlineRename($tpl));
        $(bundlesWrap).append($tpl);

        const {
            groupSeparator,
            decimalSeparator
        } = detectDigitSeparators();
        $tpl.find('input[data-field="cost"]').each((_, el) => {
            if (!AutoNumeric.getAutoNumericElement(el)) {
                new AutoNumeric(el, el.value, {
                    digitGroupSeparator: groupSeparator,
                    decimalCharacter: decimalSeparator,
                    decimalPlaces: 0,
                    maximumValue: Number.MAX_SAFE_INTEGER,
                    minimumValue: Number.MIN_SAFE_INTEGER,
                });
            }
        });

        reflectRemoveButtons();
        refreshUI();
    };

    const wireFirstBundle = () => {
        const $first = $(".card", $(bundlesWrap)).first();
        if (!$first.length) return;
        $first.data("id", String(Date.now()));
        $first.find("input[data-field]").on("input", refreshUI);
        $first.find('[data-action="remove-bundle"]').on("click", () => {
            $first.remove();
            reflectRemoveButtons();
            refreshUI();
        });
        $first.find('[data-action="edit-bundle-name"]').on("click", (e) => {
            e.preventDefault();
            enableInlineRename($first);
        });

        $first.find("[data-bundle-title]").on("click", () => enableInlineRename($first));
        reflectRemoveButtons();
    };

    const toggleAdvancedUI = () => {
        const adv = !!advancedSwitch ? .checked;
        simpleWrap && toggleClassList(simpleWrap, CLS.dNone, adv);
        advancedWrap && toggleClassList(advancedWrap, CLS.dNone, !adv);
        refreshUI();
    };

    function updateRefineryPreview() {
        // existing guards
        const adv = !!advancedSwitch ? .checked;
        const model = calcRefineryModel();

        // decide if preview should be visible at all
        let show = false;
        if (alertType === "refinery") {
            if (adv) {
                show = (model.bundles ? .length || 0) > 0 && model.days > 0;
            } else {
                show = model.totalDaily > 0 && model.days > 0;
            }
        }

        // show/hide preview card
        toggleClassList(refineryPreview, CLS.dNone, !show);
        if (!show) return;

        // write the main threshold number
        if (prevTotalNeeded)
            prevTotalNeeded.textContent = moolah_round(model.totalNeeded);

        // render advanced breakdown (or hide if simple)
        const breakdown = document.getElementById("ias-refinery-breakdown");
        if (!breakdown) return;

        if (!adv) {
            breakdown.classList.add("d-none");
            breakdown.innerHTML = "";
            return;
        }

        // Advanced: build explanation
        const rows = model.bundles.map((b) => {
            // e.g. “Bundle 1: 700 ÷ 1 d = 700/day”
            const lhs = `${moolah_round(b.cost)} ÷ ${moolah_round(b.cooldown)} d`;
            const rhs = `${moolah_round(b.perDay)}/day`;
            return `
      <div class="d-flex justify-content-between">
        <span class="text-white-50">${b.name}</span>
        <span><span class="ias-math">${lhs}</span> = <span class="ias-math">${rhs}</span></span>
      </div>`;
        });

        const totalLine = `
    <div class="mt-2 border-top pt-2 d-flex justify-content-between">
      <span class="fw-semibold">Total daily usage</span>
      <span class="fw-semibold"><span class="ias-math">${moolah_round(
        model.totalDaily
      )}/day</span></span>
    </div>`;

        const sustainLine = `
    <div class="mt-1 d-flex justify-content-between">
      <span>Days to sustain</span>
      <span><span class="ias-math">${moolah_round(model.days)} day${
      model.days === 1 ? "" : "s"
    }</span></span>
    </div>`;

        const thresholdLine = `
  <div class="mt-1 d-flex justify-content-between">
    <span>Threshold</span>
    <span>
      <span class="ias-math">⌈${moolah_round(
        model.totalDaily
      )} × ${moolah_round(model.days)}⌉</span>
      = <span class="ias-math">${moolah_round(model.totalNeeded)}</span>
    </span>
  </div>`;

        breakdown.innerHTML = `
    <div class="text-white-50 mb-1">How we calculated it:</div>
    ${rows.join("")}
    ${totalLine}
    ${sustainLine}
    ${thresholdLine}
  `;
        breakdown.classList.remove("d-none");
    }

    function updateUpgradePreview() {
        const ref = asInt(upgradeTargetInput); // reference amount
        const pctRaw = toInt(targetPercentInput ? .value); // threshold percent
        const pct = pctRaw >= 1 ? pctRaw : 0;

        // Show preview only if both fields make sense
        const show = alertType === "upgrade" && ref > 0 && pct >= 1;
        toggleClassList(upgradePreview, CLS.dNone, !show);
        if (!show) return;

        // Compute trigger units = ceil(ref * pct / 100)
        const triggerUnits = Math.ceil(ref * (pct / 100));

        if (prevUpgradeThreshold)
            prevUpgradeThreshold.textContent = moolah_round(triggerUnits);
        if (prevUpgradeRef) prevUpgradeRef.textContent = moolah_round(ref);
        if (percentBadge) percentBadge.textContent = `${pct}%`;
    }

    function updateCreateState() {
        if (!createBtn) return;
        let enabled = false;

        if (alertType === "upgrade") {
            const refOk = asInt(upgradeTargetInput) > 0;
            const pctOk = toInt(targetPercentInput ? .value) >= 1;
            enabled = refOk && pctOk;
        } else {
            const adv = !!advancedSwitch ? .checked;
            const days = adv ?
                toInt(sustainDaysAdv ? .value) :
                toInt(sustainDaysSimple ? .value);
            enabled =
                days > 0 &&
                (adv ? getBundles().length > 0 : asInt(dailyDecayInput) > 0);
        }
        createBtn.disabled = !enabled;
    }

    const refreshUI = () => {
        updateRefineryPreview();
        updateUpgradePreview();
        updateCreateState();
    };

    function openForResource(resourceId, resourceName, opts = {}) {
        if (!el || !bsModal) return;

        el.setAttribute("data-resource-id", String(resourceId));
        el.setAttribute("data-resource-name", resourceName);

        setInt("#ias-daily-decay", 0);
        $("#ias-sustain-days").val("");
        $("#ias-sustain-days-adv").val("");
        const $bundles = $("#ias-bundles .card");
        $bundles.slice(1).remove();
        $bundles.find('input[data-field="cost"]').val("0");
        $bundles.find('input[data-field="cooldown"]').val("1");
        $bundles.find("[data-bundle-title]").text("Bundle 1");
        setInt("#ias-target-amount", 0);
        $("#ias-target-percent").val("100");

        $("#ias-resource-name").text(resourceName);
        $("#inventoryAlertModal .alert-resource").text(resourceName);

        // --- new: optional prefills ---
        if (opts.upgradeTarget && Number(opts.upgradeTarget) > 0) {
            $("#ias-tabs button#tab-upgrade").tab("show");
            setInt("#ias-target-amount", opts.upgradeTarget);
        }
        if (Number.isFinite(opts.targetPercent)) {
            $("#ias-tabs button#tab-upgrade").tab("show");
            $("#ias-target-percent").val(String(opts.targetPercent));
        }

        if (opts.dailyDecay) setInt("#ias-daily-decay", opts.dailyDecay);
        if (opts.daysToSustain)
            $("#ias-sustain-days").val(String(opts.daysToSustain));

        if (opts.alertName && typeof opts.alertName === "string") {
            $("#ias-alert-name").val(opts.alertName);
        } else {
            $("#ias-alert-name").val("");
        }

        bsModal.show();
        refreshUI();
    }

    function wire() {
        // tabs
        $("#ias-tabs").on("shown.bs.tab", function(ev) {
            alertType = ev.target ? .id === "tab-upgrade" ? "upgrade" : "refinery";
            refreshUI();
        });

        // toggles
        advancedSwitch ? .addEventListener("change", toggleAdvancedUI);

        // inputs
        [
            dailyDecayInput,
            sustainDaysSimple,
            sustainDaysAdv,
            upgradeTargetInput,
            targetPercentInput,
        ]
        .filter(Boolean)
            .forEach((el) => el.addEventListener("input", refreshUI));

        // bundles
        addBundleBtn ? .addEventListener("click", addBundle);
        wireFirstBundle();

        // create
        $("#ias-create-alert")
            .off("click")
            .on("click", async () => {
                const modalEl = document.getElementById("inventoryAlertModal");
                const resourceId = Number(
                    modalEl ? .getAttribute("data-resource-id") || 0
                );
                const resourceName = modalEl ? .getAttribute("data-resource-name") || "";

                let alertName = String($("#ias-alert-name").val() || "").trim();
                if (alertName.length > 80) alertName = alertName.slice(0, 80);
                if (!alertName) alertName = `${resourceName} Alert`;

                if (alertType === "upgrade") {
                    const ref = asInt(upgradeTargetInput);
                    const pct = toInt(
                        document.getElementById("ias-target-percent") ? .value
                    );

                    const payload = {
                        name: alertName,
                        alert_type: "upgrade",
                        resource_id: resourceId,
                        targetAmount: ref > 0 ? ref : undefined,
                        targetPercent: pct >= 1 ? pct : undefined,
                        days_in_advance: 0,
                    };

                    try {
                        const resp = await $.ajax({
                            url: "/ajax.php",
                            method: "POST",
                            dataType: "json",
                            data: {
                                a: ALERT_ACTIONS.CREATE,
                                json: api.j(payload)
                            },
                        });
                        if (resp ? .status === 1) {
                            bootstrap.Modal.getOrCreateInstance(modalEl) ? .hide();
                            showFeedbackToast(
                                "Success",
                                "Inventory alert created!",
                                "success"
                            );
                        } else {
                            const msg = resp ? .msg || resp ? .error || resp ? .message || "";
                            showFeedbackToast(
                                "Error",
                                `Failed to create alert${msg ? `: ${msg}` : ""}`,
                                "danger"
                            );
                        }
                    } catch (e) {
                        const msg = ajaxErrorText(e);
                        console.error("Create upgrade alert error:", msg);
                        showFeedbackToast(
                            "Error",
                            `Error creating alert: ${msg}`,
                            "danger"
                        );
                    }
                    return;
                }

                // refinery
                const adv = !!document.getElementById("ias-advanced-mode") ? .checked;
                const dailyDecay = asInt('#ias-daily-decay');
                const daysSimple = toInt(
                    document.getElementById("ias-sustain-days") ? .value
                );
                const daysAdv = toInt(
                    document.getElementById("ias-sustain-days-adv") ? .value
                );
                const daysToSustain = adv ? daysAdv : daysSimple;

                let targetAmount;
                try {
                    targetAmount = Math.max(0, calcRefineryNeeded());
                } catch {
                    targetAmount = undefined;
                }

                const payload = {
                    name: alertName,
                    alert_type: "refinery",
                    resource_id: resourceId,
                    targetAmount: targetAmount && targetAmount > 0 ? targetAmount : undefined,
                    dailyDecay: Math.max(0, dailyDecay),
                    daysToSustain: daysToSustain > 0 ? daysToSustain : undefined,
                    days_in_advance: 0,
                };

                try {
                    const resp = await $.ajax({
                        url: "/ajax.php",
                        method: "POST",
                        dataType: "json",
                        data: {
                            a: ALERT_ACTIONS.CREATE,
                            json: api.j(payload)
                        },
                    });

                    if (resp ? .status === 1) {
                        bootstrap.Modal.getOrCreateInstance(modalEl) ? .hide();
                        showFeedbackToast("Success", "Inventory alert created!", "success");
                    } else {
                        showFeedbackToast("Error", "Failed to create alert.", "danger");
                    }
                } catch (e) {
                    const msg = ajaxErrorText(e);
                    console.error("Create refinery alert error:", msg);
                    showFeedbackToast(
                        "Fatal Error",
                        `Error creating alert: ${msg}`,
                        "danger"
                    );
                }
            });

        toggleAdvancedUI();
        refreshUI();
    }

    return {
        openForResource,
        wire
    };
})();

/* ────────────────────────────────────────────────────────────────────────────
 * UI wiring
 * ────────────────────────────────────────────────────────────────────────── */
function wireEvents() {
    // Tooltips (once)
    document
        .querySelectorAll(
            '[data-bs-toggle="tooltip"], [data-secondary-toggle="tooltip"]'
        )
        .forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el));

    // Search
    DOM.$search.on(
        "input",
        debounce((ev) => {
            state.filters.search = normalizeText(ev.target.value.trim());
            Resources.rerender();
        }, 200)
    );

    // Sort
    DOM.$sort.on("change", function() {
        state.filters.sort = $(this).val();
        Resources.rerender();
    });

    // Category change
    DOM.$category.on("change", function() {
        state.category.currentId = $(this).val();
        Resources.rerender();

        DOM.$categoryToolsDropdown.toggle(Categories.isCustomSelected());
        if (state.category.editMode) Categories.stopEdit();
        Categories.reflectMgmtButton();
    });
    Categories.reflectMgmtButton();

    // Toggles
    DOM.$hideEmpty.on("change", (e) => {
        state.filters.hideEmpty = e.target.checked;
        Resources.rerender();
    });
    DOM.$showHidden.on("change", (e) => {
        state.filters.showHidden = e.target.checked;
        Resources.rerender();
    });
    DOM.$showExact.on("change", (e) => {
        state.filters.showExact = e.target.checked;
        $(SEL.formatNumSpans).attr(
            "data-format",
            state.filters.showExact ? "exact" : "rounded"
        );
        $(SEL.container).trigger("rendered.spock");
    });

    // Start create flow
    $(SEL.chooseResources).on("click", function() {
        state.category.newName = valStr(DOM.$newCategoryName);
        Categories.startCreate();
    });

    // Resource selection (delegated)
    $(document).on("click", SEL.resourceBoxes, function() {
        if (!state.category.creationMode && !state.category.editMode) return;
        const $el = $(this);
        const id = Number($el.data("resource-id"));
        const idx = state.category.selectedResourceIds.indexOf(id);
        if (idx >= 0) {
            state.category.selectedResourceIds.splice(idx, 1);
            $el.removeClass(CLS.selectedResource);
        } else {
            state.category.selectedResourceIds.push(id);
            $el.addClass(CLS.selectedResource);
        }

        Categories.reflectSaveButtonState();

        if (state.category.editMode && state.category.editingId) {
            const custom = state.category.cachedCustom.find(
                (c) => c.id === state.category.editingId
            );
            if (custom)
                Categories.updateEditBanner(
                    custom.name,
                    state.category.selectedResourceIds.length
                );
        }
    });

    // Save new category
    DOM.$save.on("click", async function() {
        Categories.stopCreate();
        const res = await Categories.saveNew(
            state.category.newName,
            state.category.selectedResourceIds
        );
        const uuid = res ? .link ? ? res;
        if (uuid) {
            DOM.$saveUrl.val(`${LINK_URL}${uuid}`);
            DOM.$container.find(SEL.resourceBoxes).removeClass(CLS.selectedResource);
            state.category.selectedResourceIds.length = 0;
            await Categories.fetchCustom();
            Categories.populateSelectors();
            showFeedbackToast("Success", "Category created successfully");
        } else {
            DOM.$saveUrl.val("Error");
            showFeedbackToast("Error", "Failed to create category", danger);
        }

        state.category.selectedResourceIds.length = 0;
    });

    // Cancel edit
    DOM.$cancelEditCategory.on("click", () => Categories.stopEdit());

    // Update category
    DOM.$updateCategory.on("click", async function() {
        const id = state.category.editingId;
        if (!id) return;
        const custom = state.category.cachedCustom.find((c) => c.id === id);
        if (!custom) return;

        const updated = [...state.category.selectedResourceIds];
        try {
            const resp = await Categories.updateByLink(custom.link, updated);
            if (resp && resp.status === 1) {
                Categories.stopEdit();
                // mutate predicate to use updated set
                const set = new Set(updated);
                custom.filter = (r) => set.has(r.id);
                DOM.$category.val(custom.id).trigger("change");
                showFeedbackToast("Success", "Category updated successfully");
            } else {
                console.warn("Update failed:", resp ? .msg || resp);
                showFeedbackToast("Error", "Failed to update category", "danger");
            }
        } catch (e) {
            console.error("Error updating category:", e);
        }
    });

    // Category management modal open
    DOM.$categoryMgmtBtn.on("click", () => populateCategoryManagementModal());

    // Modal actions (delegated)
    DOM.$categoryMgmtList.on("click", ".rename-category-btn", function() {
        const catId = $(this).data("category-id");
        DOM.$category.val(catId).trigger("change");
        const custom = state.category.cachedCustom.find((c) => c.id === catId);
        setText(
            "#rename-category-current",
            custom ? `Current name: ${custom.name}` : ""
        );
        DOM.$renameInput.val("");
        DOM.$renameError.hide();
        $(SEL.renameCategoryModal).modal("show");
        $(SEL.categoryManagementModal).modal("hide");
    });

    DOM.$categoryMgmtList.on("click", ".edit-category-btn", function() {
        const catId = $(this).data("category-id");
        Categories.startEdit(catId);
        $(SEL.categoryManagementModal).modal("hide");
    });

    DOM.$categoryMgmtList.on("click", ".delete-category-btn", function() {
        const catId = $(this).data("category-id");
        DOM.$category.val(catId).trigger("change");
        const custom = state.category.cachedCustom.find((c) => c.id === catId);
        DOM.$deleteName.text(custom ? `Category: ${custom.name}` : "");
        $(SEL.deleteCategoryModal).modal("show");
        $(SEL.categoryManagementModal).modal("hide");
    });

    DOM.$categoryMgmtList.on("click", ".share-category-btn", function() {
        const catId = $(this).data("category-id");
        const custom = state.category.cachedCustom.find((c) => c.id === catId);
        DOM.$shareUrlBox.val(custom ? `${LINK_URL}${custom.link}` : "");
        $(SEL.shareModal).modal("show");
        $(SEL.categoryManagementModal).modal("hide");
    });

    // Confirm delete
    $(SEL.confirmDeleteCategory).on("click", async function() {
        const id = DOM.$category.val();
        const custom = state.category.cachedCustom.find((c) => c.id === id);
        if (!custom) return;
        try {
            const resp = await Categories.deleteByLink(custom.link);
            if (resp ? .status === 1) {
                state.category.cachedCustom = state.category.cachedCustom.filter(
                    (c) => c.id !== custom.id
                );
                DOM.$category.find(`option[value="${custom.id}"]`).remove();
                DOM.$category.val("all").trigger("change");
                $(SEL.deleteCategoryModal).modal("hide");
                showFeedbackToast("Success", "Category deleted successfully");
            } else {
                console.warn("Delete failed:", resp ? .msg || resp);
                showFeedbackToast("Error", "Failed to delete category", "danger");
            }
        } catch (e) {
            console.error("Error deleting category:", e);
        }
    });

    // Share helpers
    $(SEL.shareCategoryOption).on("click", function() {
        const id = DOM.$category.val();
        const custom = state.category.cachedCustom.find((c) => c.id === id);
        DOM.$shareUrlBox.val(custom ? `${LINK_URL}${custom.link}` : "");
    });
    DOM.$shareCategory.on("change", function() {
        const link = $(this).val();
        DOM.$shareUrlBox.val(link ? `${LINK_URL}${link}` : "");
    });

    // Copy buttons
    DOM.$copyNewShareUrl.on("click", async (ev) => {
        await copyToClipboardWithFeedback(DOM.$saveUrl.val(), ev.currentTarget);
    });

    DOM.$copyShareUrl.on("click", async (ev) => {
        await copyToClipboardWithFeedback(DOM.$shareUrlBox.val(), ev.currentTarget);
    });

    // Import modal prefill
    DOM.$import.on("click", function() {
        DOM.$importUrlBox.val(state.preview.id ? ? "");
        DOM.$importNameBox.val(state.preview.name ? ? "");
    });

    // Import action
    DOM.$importCategory.on("click", async function() {
        const url = valStr(DOM.$importUrlBox);
        const name = valStr(DOM.$importNameBox);
        if (!url || !name) return;
        await Categories.saveNew(name, state.preview.importedResourceIds);
        await Categories.fetchCustom();
        Categories.populateSelectors();
    });

    // Export
    DOM.$inventoryExport.on("click", async (event) => {
        let content = "ID\tName\tAmount\n";
        for (const r of [...state.resources.currentView].toSorted(sortResources)) {
            content += `${r.id}\t${r.name}\t${
        state.user.resourcesById.get(r.id) ?? 0
      }\n`;
        }
        await copyToClipboardWithFeedback(content, $(event.target));
    });

    // Rename (open)
    $(SEL.renameCategoryBtn).on("click", function() {
        const id = DOM.$category.val();
        const custom = state.category.cachedCustom.find((c) => c.id === id);
        setText(
            "#rename-category-current",
            custom ? `Current name: ${custom.name}` : ""
        );
        DOM.$renameInput.val("");
        DOM.$renameError.hide();
    });

    // Rename confirm
    DOM.$renameConfirm.on("click", async function() {
        const newName = valStr(DOM.$renameInput);
        if (newName.length < 2) {
            DOM.$renameError.text("Name must be at least 2 characters.").show();
            return;
        }
        const id = DOM.$category.val();
        const custom = state.category.cachedCustom.find((c) => c.id === id);
        if (!custom) return DOM.$renameError.text("Invalid category.").show();

        try {
            const resp = await Categories.renameByLink(custom.link, newName);
            if (resp ? .status === 1) {
                custom.name = newName;
                DOM.$category.find(`option[value="${id}"]`).text(newName);
                $(SEL.renameCategoryModal).modal("hide");
                showFeedbackToast("Success", "Category renamed successfully");
            } else {
                DOM.$renameError.text(resp ? .msg || "Rename failed.").show();
                showFeedbackToast("Error", "Failed to rename category", "danger");
            }
        } catch (e) {
            console.error("Error renaming category:", e);
            DOM.$renameError.text("Error renaming category.").show();
        }
    });

    // Resource “info” → open alert modal
    $(document).on("click", SEL.resourceInfoIcon, function(ev) {
        ev.stopPropagation();
        const $box = $(this).closest(SEL.resourceBoxes);
        const resourceId = Number($box.data("resource-id"));
        const resourceName = String($box.data("resource-name"));
        InventoryAlertModal.openForResource(resourceId, resourceName);
    });

    // Alerts modal lifecycle
    $(SEL_ALERTS.modal).on("show.bs.modal", () => loadAlertsIntoModal());

    // Alerts delete (delegated)
    $(document).on("click", ".alerts-delete-btn", async function() {
        const id = Number($(this).data("alert-id"));
        if (!id) return;
        const $btn = $(this);
        const $row = $btn.closest("[data-alert-id]");
        $btn.prop("disabled", true);
        $row.css("opacity", 0.6);

        try {
            const ok = await $.ajax({
                url: "/ajax.php",
                method: "POST",
                dataType: "json",
                data: {
                    a: ALERT_ACTIONS.DELETE,
                    id
                },
            });
            if (ok ? .status === 1 || ok === true) {
                await loadAlertsIntoModal();
            } else {
                $btn.prop("disabled", false);
                $row.css("opacity", 1);
            }
        } catch (e) {
            $btn.prop("disabled", false);
            $row.css("opacity", 1);
        }
    });

    // Wire alert modal internals
    InventoryAlertModal.wire();

    // Toast actions (delegated) — keep close to toast wiring
    $(document).on("click", ".alert-ack-btn", async function() {
        const id = Number($(this).data("alert-id"));
        if (!id) return;
        try {
            const resp = await ackInventoryAlerts([id]);
            if (resp ? .status === 1) {
                const $toast = $(this).closest(".toast");
                const inst = bootstrap.Toast.getOrCreateInstance($toast[0]);
                inst.hide();
                $toast.remove();
                clearSnooze(id);
            }
        } catch (e) {
            console.error("ack failed", e);
        }
    });

    $(document).on("click", ".alert-snooze-btn", function() {
        const id = Number($(this).data("alert-id"));
        if (!id) return;
        setSnooze(id, 24); // 24-hour local snooze
        const $toast = $(this).closest(".toast");
        const inst = bootstrap.Toast.getOrCreateInstance($toast[0]);
        inst.hide();
        $toast.remove();
    });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Category Management modal population
 * ────────────────────────────────────────────────────────────────────────── */
function populateCategoryManagementModal() {
    const $container = DOM.$categoryMgmtList;
    const template = DOM.$categoryMgmtItemTemplate.html();

    if (!Array.isArray(state.category.cachedCustom) ||
        state.category.cachedCustom.length === 0
    ) {
        $container.html(
            '<div class="text-muted">No custom categories found.</div>'
        );
        return;
    }

    $container.empty();
    const $list = $('<div class="list-group"></div>');
    for (const c of state.category.cachedCustom) {
        $list.append(Mustache.render(template, {
            id: c.id,
            name: c.name
        }));
    }
    $container.append($list);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Boot
 * ────────────────────────────────────────────────────────────────────────── */
async function boot() {
    const hasInventoryUI = DOM.$template.length > 0 && DOM.$container.length > 0;

    // The alert modal might exist globally (modals.php) even if the inventory UI doesn't.
    // Always wire the alert modal if present, but only run the heavy inventory init when UI exists.

    try {
        InventoryAlertModal ? .wire ? .();
    } catch (e) {}

    $("#inventoryAlertModal").on("show.bs.modal", function(event) {
        const {
            groupSeparator,
            decimalSeparator
        } = detectDigitSeparators();

        for (const selector of [
                "#ias-daily-decay",
                '[data-field="cost"]',
                "#ias-target-amount",
            ]) {
            for (const el of event.target.querySelectorAll(selector)) {
                el.type = "text";

                const instance = AutoNumeric.getAutoNumericElement(el);
                if (instance === null) {
                    new AutoNumeric(el, el.value, {
                        digitGroupSeparator: groupSeparator,
                        decimalPlaces: 0,
                        decimalCharacter: decimalSeparator,

                        maximumValue: Number.MAX_SAFE_INTEGER,
                        minimumValue: Number.MIN_SAFE_INTEGER,
                    });
                }
            }
        }
    });

    if (!hasInventoryUI) {
        // We're on a page like "requirements" that wants the alert modal API only.
        // Skip the inventory app initialization silently.
        return;
    }

    // From here down, we know we're on the inventory page.
    state.ui.templateHtml = DOM.$template.html() || "";
    if (!state.ui.templateHtml) {
        // Template missing on a page that otherwise looked like inventory — bail quietly.
        return;
    }

    await Resources.load();

    const hasUser = await User.load();
    if (hasUser) {
        await Categories.fetchCustom();
        Categories.populateSelectors();
    } else {
        disableTopControls(true);
    }

    // URL share/preview
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get("category_id");
    if (categoryId) {
        try {
            const resp = await Categories.loadPreviewByLink(categoryId);
            if (resp ? .resource_ids) {
                state.preview.id = categoryId;
                state.preview.name = resp.name ? ? null;
                state.preview.importedResourceIds = [...resp.resource_ids];

                // Build a deterministic view from known IDs
                const map = new Map();
                for (const id of resp.resource_ids) {
                    const r = state.resources.byId.get(id);
                    if (r) map.set(id, r);
                }
                state.resources.currentView = [...map.values()];
                Resources.render();

                // Lock UI for preview
                disableTopControls(true);
                setDisabled(DOM.$search, true);
                setDisabled(DOM.$createNew, true);
                setDisabled(DOM.$share, true);
                return; // stop here; no wiring in preview mode
            }
        } catch (e) {
            console.error("Error loading category from URL:", e);
        }
    }

    // Normal first paint
    Resources.rerender();
    wireEvents();
}

/* DOM ready */
$(() => {
    boot().catch((e) => console.error(e));
});

// Allow pages that don’t import this module to still open the modal
if (typeof window !== "undefined") {
    window.InventoryAlertModal = InventoryAlertModal;
}