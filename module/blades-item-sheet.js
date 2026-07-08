/**
 * Extend the basic ItemSheet
 * @extends {foundry.appv1.sheets.ItemSheet}
 */
import { onManageActiveEffect, prepareActiveEffectCategories } from "./effects.js";
import { BladesActiveEffect } from "./blades-active-effect.js";

export class BladesItemSheet extends foundry.appv1.sheets.ItemSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["beamsaber", "sheet", "item"],
			width: 560,
			height: 'auto',
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}]
		});
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/beamsaber/templates/items";
    let simple_item_types = ["crew_reputation"];
    let template_name = `${this.item.type}`;

    if (simple_item_types.indexOf(this.item.type) >= 0) {
      template_name = "simple";
    }

    return `${path}/${template_name}.html`;
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find(".effect-control").click(ev => {
      if ( this.item.isOwned ) return ui.notifications.warn(game.i18n.localize("BITD.EffectWarning"));
      ev.preventDefault();
      BladesActiveEffect.onManageActiveEffect(ev, this.item);
    });

    html.find('label.radio-toggle').click((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle').contextmenu((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });

    html.find('.add-quality').click(async (e) => {
      await this.object.update({'system.quality_modifier': this.object.system.quality_modifier + 1});
      await this.object.updateCohortQualityScale();
    });
    html.find('.remove-quality').click(async (e) => {
      await this.object.update({'system.quality_modifier': this.object.system.quality_modifier - 1});
      await this.object.updateCohortQualityScale();
    });
    html.find('.add-scale').click(async (e) => {
      await this.object.update({'system.scale_modifier': this.object.system.scale_modifier + 1});
      await this.object.updateCohortQualityScale();
    });
    html.find('.remove-scale').click(async (e) => {
      await this.object.update({'system.scale_modifier': this.object.system.scale_modifier - 1});
      await this.object.updateCohortQualityScale();
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData(options);
    const sheetData = superData.data;

    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.document = superData.document;
    sheetData.isGM = game.user.isGM;

    // Prepare Active Effects
    sheetData.effects = prepareActiveEffectCategories(this.document.effects);

    //sheetData.system.description = foundry.applications.ux.TextEditor.enrichHTML(sheetData.system.description, {secrets: sheetData.owner, async: false});

    sheetData.system.container_item_type_list = {
      item: {label: 'TYPES.Item.item'},
      vehicle_gear: {label: 'TYPES.Item.vehicle_gear'}
    }

    return sheetData;
  }
}
