import { BladesHelpers } from "./blades-helpers.js";
import { ClockStylesData } from "./models/clock-styles.js";

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function(oldVersion, newVersion) {
  ui.notifications.info(`Applying Beamsaber Actors migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  // Migrate World Actors
  let actors = foundry.utils.deepClone(game.actors.contents);
  actors.sort(BladesHelpers._relationshipCompareFunc);
  for (let a of actors) {
    try {
      const updateActorData = await _migrateActor(a, oldVersion);
      if (Object.keys(updateActorData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
        await BladesHelpers.tryUpdate(a, updateActorData);
      }

      // Migrate Actor Items as well
      for (let i of a.items.contents) {
        try {
          const updateItemData = await _migrateItem(i, oldVersion);
          if (Object.keys(updateItemData).length > 0) {
            console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name} from ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
            await BladesHelpers.tryUpdate(i, updateItemData);
          }
        } catch(err) {
          console.error(err);
        }
      }
    } catch(err) {
      console.error(err);
    }

    // Migrate Token Link for Character and Squad
    /*if (a.type === 'character' || a.type === 'crew') {
      try {
        const updateData = _migrateTokenLink(a);
        if (Object.keys(updateData).length > 0) {
          console.log(`Migrating Token Link for ${a.name}`);
          await BladesHelpers.tryUpdate(a, updateData);
        }
      } catch(err) {
        console.error(err);
      }
    }*/
  }

  // Migrate Items
  let items = foundry.utils.deepClone(game.items.contents);
  for (let i of items) {
    try {
      const updateData = await _migrateItem(i, oldVersion);
      if (Object.keys(updateData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name}`);
        await BladesHelpers.tryUpdate(i, updateData);
      }
    } catch(err) {
      console.error(err);
    }
  }

  _migrateSettings(oldVersion);

  // Set the migration as complete
  game.settings.set("beamsaber", "systemMigrationVersion", newVersion);
  ui.notifications.info(`Beamsaber System Migration to version ${game.system.version} completed!`, {permanent: true});
};

/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate the actor attributes
 * @param {Actor} actor   The actor to Update
 * @return {Promise<Object>}       The updateData to apply
 */
async function _migrateActor(actor, version) {
  let updateData = null;

  if (version < 4.1) {
    if (actor.type == 'character') {
      updateData = {
        'system.==trauma': {
          'value': 0,
          'max': 4,
          'values': {
            'one': '',
            'two': '',
            'three': '',
            'four': ''
          }
        }
      };
    }
  }

  return updateData ?? {};
}

/**
 * Migrate the itrm attributes
 * @param {Item} item   The item to Update
 * @return {Promise<Object>}    The updateData to apply
 */
async function _migrateItem(item, version) {
  let updateData = null;

  return updateData ?? {};
}

/* -------------------------------------------- */

/**
 * Make Token be an Actor link.
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateTokenLink(actor) {
  let updateData = {}
  updateData['prototypeToken.actorLink'] = true;

  return updateData;
}

/* -------------------------------------------- */

/**
 * Make Token be an Actor link.
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateSettings(oldVersion) {
  if (oldVersion < 4.2) {
    // Update Clock Styles
    let clockStyles = game.settings.get('beamsaber', 'ClockStyles').contents;
    let defaultClockStyles = {
      flower: {
        pink: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        }
      }
    };
    clockStyles = foundry.utils.mergeObject(clockStyles, defaultClockStyles);
    game.settings.set('beamsaber', 'ClockStyles', new ClockStylesData(clockStyles));
  }
}

/* -------------------------------------------- */