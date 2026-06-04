
import { BladesHelpers } from "../blades-helpers.js";
import { BladesSheet } from "../blades-sheet.js";

/**
 * @extends {BladesSheet}
 */
export class BladesRegionSheet extends BladesSheet {
  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["beamsaber", "sheet", "actor", "region"],
  	  template: "systems/beamsaber/templates/actors/region-sheet.html",
      width: 550,
      height: 650,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "squads"}]
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

    // Fetch data
    sheetData.system.owner = BladesHelpers.resolveActor(sheetData.system.owner, { name: "Unknown Owner" });
    sheetData.system.squads = BladesHelpers.fetchSimpleData(sheetData.system.squads, [], BladesHelpers._factionSquadCompareFunc);
    sheetData.system.npcs = BladesHelpers.fetchSimpleData(sheetData.system.npcs, [], BladesHelpers._simpleCompareFunc);
    sheetData.system.characters = BladesHelpers.fetchSimpleData(sheetData.system.characters, [], BladesHelpers._simpleCompareFunc);
    sheetData.system.notables = sheetData.system.npcs.concat(sheetData.system.characters);
    sheetData.system.notables.sort(BladesHelpers._simpleCompareFunc);

    // Fetch squad members
    let members = [];
    for (let squad of sheetData.system.squads) {
      let squadInfo = {uuid: squad.uuid, name: squad.name, img: squad.img, region_collapsed: squad.system.region_collapsed, members: []};
      for (let member of Object.values(squad.system.members))
        squadInfo.members.push(BladesHelpers.resolveActor(member, { name: "Unknown Member" }));
      members.push(squadInfo);
    }
    sheetData.system.squad_members = members;
    sheetData.uuid = 'Actor.' + sheetData._id;

    // Remove assigned notables from the list
    sheetData.system.notables = sheetData.system.notables.filter(n => !sheetData.system.squad_members.find(s => s.members.includes(n)));

    return sheetData;
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }

  /** @override */
  async handleDrop(event, droppedEntity) {
    let droppedEntityFull = BladesHelpers.resolveActor(droppedEntity.uuid);
    await this.handleAddedObjects([droppedEntityFull]);
  }

  async handleAddedObjects(droppedEntitiesFull) {
    let currentTab = this._tabs[0].active;
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'faction':
          await BladesHelpers.addRegionOwner(droppedEntityFull, this.actor, false);
          break;
        case 'crew':
          if (currentTab == 'squads')
            await BladesHelpers.addSquadRegion(droppedEntityFull, this.actor, false);
          else
            await BladesHelpers.addRegionOwner(droppedEntityFull, this.actor, false);
          break;
        case 'character':
          await BladesHelpers.addCharacterRegion(droppedEntityFull, this.actor, false);
          break;
        case 'npc':
          await BladesHelpers.addRegionNPC(this.actor, droppedEntityFull, true);
          break;
        default:
          break;
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Delete Squad
    html.find('.delete-squad').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let squadFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (squadFull)
        await BladesHelpers.removeSquadRegion(squadFull);
    });

    // Collapse squad
    html.find('.collapse').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentSquadId = element.data('itemId');
      let squadFull = BladesHelpers.resolveActor(currentSquadId);
      let childrenElement = $(element[0].parentElement).children('.item-container');
      childrenElement.slideToggle(200, async () => await BladesHelpers.tryUpdate(squadFull, {system: {'==region_collapsed': !squadFull.system.region_collapsed}}));
    });

    // Delete Notable Person
    html.find('.delete-notable').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let notableFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (notableFull)
        if (notableFull.type == 'npc')
          await BladesHelpers.removeNPCRegion(notableFull);
        else if (notableFull.type == 'character')
          await BladesHelpers.removeCharacterRegion(notableFull);
    });

    html.find('.add-owner').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentConnectionId = element.data('connectionId');
      let ownerFull = BladesHelpers.resolveActor(this.actor.system.owner);

      let contents = `
        <h2>${game.i18n.localize('BITD.AddRegionOwner')}</h2>
        <p>${game.i18n.localize('BITD.AddRegionOwnerInfo')}</p>
        <div class="form-group" data-actor-id="${ownerFull ? ownerFull.uuid : 'null'}">${ownerFull ? `
          <div class="actor-contents flex-horizontal">
            <img src="${ownerFull.img}" data-tooltip="${ownerFull.name}" width="48" height="48"/>
            <a class="item-name">${ownerFull.name}</a>
            <a class="delete-actor"><i class="fas fa-times"></i></a>
          </div>` : ''}
        </div>`;

      let dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('BITD.AddRegionOwner')}` },
        content: contents,
        classes: ['add-region-owner'],
        buttons: [
          {
            icon: 'fas fa-floppy-disk',
            label: game.i18n.localize('BITD.Update'),
            action: 'update',
          },
          {
            icon: 'fas fa-times',
            label: game.i18n.localize('Cancel'),
            action: 'cancel',
          }
        ],
        submit: async (result, dialog) => {
          if (result != 'update') return;

          let actorUuid = dialog.element.querySelector('[data-actor-id]').dataset.actorId;
          let actorFull = BladesHelpers.resolveActor(actorUuid);
          if (actorUuid == 'null' && dialog.actor.system.owner)
            await BladesHelpers.removeRegionOwner(dialog.actor);
          else if (actorFull && actorUuid != dialog.actor.system.owner)
            await BladesHelpers.addRegionOwner(actorFull, dialog.actor, false);
        }
      });
      dialog.actor = this.actor;
      await dialog.render(true);

      dialog.element.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        let element = ev.currentTarget;
        const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        const formGroup = element.querySelector('.form-group');
        if (dropData.uuid) {
          let dropFull = BladesHelpers.resolveActor(dropData.uuid);
          if (!['faction', 'crew'].includes(dropFull.type)) {
            const {type, id, collection} = foundry.utils.parseUuid(dropData.uuid) ?? {};
            ui.notifications.warn(game.i18n.format('BITD.log.warn.AddRegionOwnerBadType', {type: game.i18n.localize(`TYPES.${type}.${dropFull.type}`)}));
            return;
          }
          formGroup.dataset.actorId = dropFull.uuid;
          formGroup.innerHTML = `
            <div class="actor-contents flex-horizontal">
              <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="48" height="48"/>
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;

          formGroup.querySelector('.delete-actor').addEventListener('click', (ev) => {
            formGroup.innerHTML = '';
            formGroup.dataset.actorId = 'null';
          });
        }
      });
      for (const element of dialog.element.querySelectorAll('.form-group .delete-actor'))
        element.addEventListener('click', (ev) => {
          const formGroup = element.closest('.form-group');
          formGroup.innerHTML = '';
          formGroup.dataset.actorId = 'null';
        });
    });

    // Delete Owner
    html.find('.delete-owner').click(async ev => {
      await BladesHelpers.removeRegionOwner(this.actor);
    });
	}
}
