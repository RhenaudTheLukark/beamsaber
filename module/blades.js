/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { registerSystemSettings } from "./settings.js";
import { registerSystemKeybinds } from"./keybinds.js";
import { preloadHandlebarsTemplates } from "./blades-templates.js";
import { bladesRoll, cancelRollResult, simpleRollPopup } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActor } from "./blades-actor.js";
import { BladesItem } from "./blades-item.js";
import { BladesItemSheet } from "./blades-item-sheet.js";
import { BladesFactionSheet } from "./actors/blades-faction-sheet.js";
import { BladesSquadSheet } from "./actors/blades-crew-sheet.js";
import { BladesCharacterSheet } from "./actors/blades-character-sheet.js";
import { BladesCharacterSheetV2 } from "./actors/blades-character-sheet-v2.js";
import { BeamVehicleSheet } from "./actors/beam-vehicle-sheet.js";
import { BladesRegionSheet } from "./actors/blades-region-sheet.js";
import { BladesNPCSheet } from "./actors/blades-npc-sheet.js";
import { BladesClockSheet } from "./actors/blades-clock-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { ClockStylesSettings } from "./settings/clock-styles.js";
import { BeamChatMessage } from "./messages/beam-chat-message.js";
import { migrateWorld } from "./migration.js";


window.BladesHelpers = BladesHelpers;

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", async function () {
  console.log(`Initializing Blades In the Dark System`);

  game.blades = {
    dice: bladesRoll,
    roller: simpleRollPopup
  };
  game.system.bladesClocks = {
    sizes: [4, 6, 8, 10, 12]
  };

  game.system.traumas = ["cold", "haunted", "obsessed", "paranoid", "reckless", "soft", "unstable", "vicious"];

  CONFIG.Item.documentClass = BladesItem;
  CONFIG.Actor.documentClass = BladesActor;
  CONFIG.ActiveEffect.documentClass = BladesActiveEffect;
  CONFIG.ChatMessage.documentClass = BeamChatMessage;

  // Register System Settings & Keybinds
  registerSystemSettings();
  registerSystemKeybinds();

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("blades", BladesFactionSheet, { types: ["faction"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BladesSquadSheet, { types: ["crew"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BladesCharacterSheet, { types: ["character"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BeamVehicleSheet, { types: ["vehicle"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BladesRegionSheet, { types: ["region"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BladesNPCSheet, { types: ["npc"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("blades", BladesClockSheet, { types: ["\uD83D\uDD5B clock"], makeDefault: true });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("blades", BladesItemSheet, { makeDefault: true });
  foundry.documents.collections.WorldSettings.registerSheet("blades", ClockStylesSettings, {});
  await preloadHandlebarsTemplates();

  foundry.documents.collections.Actors.registeredSheets.forEach(element => console.log(element.Actor.name));

  if (game.settings.get('beamsaber', "PublicClocks")) {
    Hooks.on("preCreateActor", (actor, createData, options, userId) => {
      if (actor.type === "\uD83D\uDD5B clock") {
        actor.updateSource({
          'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
        });
      }
    });
  }

  Handlebars.registerHelper('andtest', function () {
    return Array.prototype.every.call(arguments, Boolean);
  });

  // Multiboxes.
  Handlebars.registerHelper('multiboxes', function (selected, options) {
    let html = options.fn(this);
    // Fix for single non-array values.
    if (!Array.isArray(selected))
      selected = [selected];

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while ((oldHtml === html) && (escapedValue >= 0)) {
            escapedValue--;
            rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
    return html;
  });

  // Negative multiboxes
  Handlebars.registerHelper('negative-multiboxes', function (selected, options) {
    let html = options.fn(this);
    // Fix for single non-array values.
    if (!Array.isArray(selected))
      selected = [selected];

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while ((oldHtml === html) && (escapedValue != 0)) {
            if (escapedValue > 0)
              escapedValue++;
            else
              escapedValue--;
            rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
    return html;
  });

  // Trauma Counter
  Handlebars.registerHelper('traumacounter', function (selected, options) {
    let html = options.fn(this);
    var count = 0;
    for (const trauma in selected)
      if (selected[trauma] === true)
        count++;

    const rgx = new RegExp('value=[\"\']' + count + '[\"\']');
    return html.replace(rgx, "$& checked");
  });

  Handlebars.registerHelper('and', (a, b) => {
    return a && b;
  });

  Handlebars.registerHelper('xor', (a, b) => {
    return a ^ b;
  });

  Handlebars.registerHelper('or', (a, b) => {
    return a || b;
  });

  Handlebars.registerHelper('not', (a) => {
    return !a;
  });

  //Less than comparison
  Handlebars.registerHelper('lteq', (a, b) => {
    return (Number(a) <= Number(b));
  });

  //Greater than comparison
  Handlebars.registerHelper('gteq', (a, b) => {
    return (Number(a) >= Number(b));
  });

  Handlebars.registerHelper('oneless', (a) => {
    return (a - 1);
  });

  // Checks if an array is empty
  Handlebars.registerHelper('isempty', (a) => {
    return a.length == 0;
  });

  //Reputation and Turf Bar on Squad Sheet
  Handlebars.registerHelper('rep_heart', (_id, heart, max_rep, options) => {
    let html = options.fn(this);
    var heart_int = parseInt(heart);
    for (let i = 1; i <= max_rep; i++) {
      if (i > max_rep - heart_int)
        html += `<input disabled type="radio" id="crew-${_id}-reputation-${i}" name="system.reputation.value" value="${i} dtype="Radio"><label style="background-image: url('systems/beamsaber/styles/assets/teeth/stresstooth-black.png')" class="radio-toggle"></label>`;
      else
        html += `<input type="radio" id="crew-${_id}-reputation-${i}" name="system.reputation.value" value="${i}" dtype="Radio"><label class="radio-toggle"></label>`;
    }

    return html;
  });

  Handlebars.registerHelper('crew_experience', (options) => {
    let html = options.fn(this);
    for (let i = 1; i <= 10; i++)
      html += '<input type="radio" id="crew-experience-' + i + '" name="data.experience.max" value="' + i + '" dtype="Radio"><label for="crew-experience-' + i + '"></label>';
    return html;
  });

  // Enrich the HTML replace /n with <br>
  Handlebars.registerHelper('html', (options) => {
    if (!options.hash['text']) return '';
    let text = options.hash['text'].replace(/\n/g, "<br />");
    return new Handlebars.SafeString(text);
  });

  // times_from_1 left as legacy code to not break Alternate Sheets compatibility
  Handlebars.registerHelper('times_from_1', function (n, block) {
    var accum = '';
    for (var i = 1; i <= n; ++i)
      accum += block.fn(i);
    return accum;
  });

  // times_from_0 left as legacy code to not break Alternate Sheets compatibility
  Handlebars.registerHelper('times_from_0', function (n, block) {
    var accum = '';
    for (var i = 0; i <= n; ++i)
      accum += block.fn(i);
    return accum;
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from start.
  //
  // Usage:
  // {{#times_from 1 10}}
  //   <span>{{this}}</span>
  // {{/times_from}}
  Handlebars.registerHelper('times_from', function (start, n, block) {
    let accum = '';
    for (let i = start; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // Concat helper
  // https://gist.github.com/adg29/f312d6fab93652944a8a1026142491b1
  // Usage: (concat 'first' 'second')
  Handlebars.registerHelper('concat', function () {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('capitalize', function (str) {
    return BladesHelpers.capitalize(str);
  })

  Handlebars.registerHelper('getItemOwner', async function (actorId, itemId) {
    let actorFull = BladesHelpers.resolveActor(actorId);
    return actorFull.getItemOwner(itemId)[0];
  })

  /**
   * @inheritDoc
   * Takes label from Selected option instead of just plain value.
   */
  Handlebars.registerHelper('selectOptionsWithLabel', function (choices, options) {
    const localize = options.hash['localize'] ?? false;
    let selected = options.hash['selected'] ?? null;
    let blank = options.hash['blank'] || null;
    selected = selected instanceof Array ? selected.map(String) : [String(selected)];

    // Create an option
    const option = (key, object) => {
      if (localize) object.label = game.i18n.localize(object.label);
      let isSelected = selected.includes(key);
      html += `<option value="${key}" ${isSelected ? "selected" : ""}>${object.label}</option>`
    };

    // Create the options
    let html = "";
    if (blank) option("", blank);
    Object.entries(choices).forEach(e => option(...e));

    return new Handlebars.SafeString(html);
  });

  /**
   * Create appropriate Blades clock
   */
  function handleBladesClock(theme, color, size, valuePath, fill, uniqueId, objPath, isDefaultStyle, isVehicleProxy, isVehicle) {
    let html = '';
    if (!fill || fill === 'null')
      fill = 0;
    if (!color)
      color = "black";
    if (parseInt(fill) > parseInt(size))
      fill = size;

    let clockStyles = BladesHelpers.clockStyles;
    let clockData = clockStyles?.[theme]?.[color]?.[size];
    let clockSpritePath;
    if (!clockData)
      clockSpritePath = 'systems/beamsaber/themes/error.png';
    else
      clockSpritePath = `${BladesHelpers.getClockSpritePath(clockData)}${size}clock_${fill}.${clockData.extension}`;

    html += `<div${clockData?.shifted ? ' class="shifted"' : ''}>`;
    html += `<div id="blades-clock-${uniqueId}" class="blades-clock clock-${size} clock-${size}-${fill}">`;

    let zeroChecked = (parseInt(fill) === 0) ? ' checked' : '';
    html += `<input ${isVehicleProxy ? 'class="vehicle-data" ' : (isVehicle ? 'class="pilot-shared-data" ' : '')}type="radio" value='0' id="clock-0-${uniqueId}}" data-dType="String" ${isVehicleProxy ? 'data-' : ''}name='${valuePath}'${zeroChecked}>`;

    for (let i = 1; i <= parseInt(size); i++) {
      let checked = (parseInt(fill) === i) ? ' checked' : '';
      html += `
        <input ${isVehicleProxy ? 'class="vehicle-data" ' : (isVehicle ? 'class="pilot-shared-data" ' : '')}type="radio" value='${i}' id="clock-${i}-${uniqueId}" data-dType="String" ${isVehicleProxy ? 'data-' : ''}name='${valuePath}'${checked}>
        <label class="radio-toggle${checked ? ' enabled' : ''}"></label>
      `;
    }

    html += `<img src="${clockSpritePath}" data-theme="${theme}" data-color="${color}" data-size="${size}" data-fill="${fill}" onerror="return BladesHelpers.handleClockImageError(event)"/>`;
    if (objPath)
      html += `<a class="clock-style-picker" data-path="${objPath}.theme_color" data-theme-color="${isDefaultStyle ? 'null' : `${theme}/${color}`}"><i class="fas fa-gear"></i></a>`;
    html += `</div></div>`;
    return html;
  }

  // Clocks to add in sheets
  Handlebars.registerHelper('blades-clock', function(theme, color, size, valuePath, fill, uniqueId, isVehicleProxy, isVehicle) {
    return handleBladesClock(theme, color, size, valuePath, fill, uniqueId, null, null, isVehicleProxy, isVehicle);
  });
  Handlebars.registerHelper('blades-clock-object', function(clockData, clockDataPath, uniqueId, defaultThemeColor, isVehicleProxy, isVehicle) {
    let theme = clockData.theme;
    let color = clockData.color;
    let isDefaultStyle = false;
    if (clockData.theme_color && clockData.theme_color != 'null') {
      let themeColor = clockData.theme_color.split('/');
      theme = themeColor[0];
      color = themeColor[1];
    }
    if (!theme || !color) {
      defaultThemeColor = defaultThemeColor.split('/');
      theme = defaultThemeColor[0];
      color = defaultThemeColor[1];
      isDefaultStyle = true;
    }
    return handleBladesClock(theme, color, clockData.max, `${clockDataPath}.value`, clockData.value, uniqueId, clockDataPath, isDefaultStyle, isVehicleProxy, isVehicle);
  });

  // Computes clock sizes for a given theme
  Handlebars.registerHelper('clock-sizes', function(clockData, defaultThemeColor) {
    let themeColor = clockData.theme_color;
    if (!themeColor || themeColor == 'null')
      themeColor = defaultThemeColor;
    themeColor = themeColor.split('/');
    let theme = themeColor[0];
    let color = themeColor[1];

    let themeColorSizes = Object.keys(BladesHelpers.clockStyles?.[theme]?.[color] ?? {}).filter(s => s != 'dataReason').map(s => Number(s));
    if (!themeColorSizes.includes(clockData.max)) {
      themeColorSizes.push(clockData.max);
      themeColorSizes.sort((a, b) => a - b);
    }
    return Object.fromEntries(themeColorSizes.map(s => [String(s), String(s)]));
  });

  Handlebars.registerHelper('pc', function (string) {
    return BladesHelpers.capitalize(string);
  });

  // check for game settings
  Handlebars.registerHelper('getSetting', function (string) {
    return (game.settings.get('beamsaber', string));
  });

  Handlebars.registerHelper('modulo', (target, divisor) => target % divisor);

  Handlebars.registerHelper('add', (a, b) => { return Number(a) + Number(b); });
  Handlebars.registerHelper('minus', (a, b) => { return Number(a) - Number(b); });

  Handlebars.registerHelper('number-to-roman', function (num) {
    let result = "?";
    switch (Number(num)) {
      case 0: result = "0";   break;
      case 1: result = "I";   break;
      case 2: result = "II";  break;
      case 3: result = "III"; break;
      case 4: result = "IV";  break;
      case 5: result = "V";   break;
      default:                break;
    }
    return result;
  });

  Handlebars.registerHelper("resolvePath", function (path) {
    const str = String(path);
    const pathNormalized = ['/', '\\'].includes(str[0]) ? str.substring(1) : str;
    return `systems/beamsaber/${pathNormalized}`;
  });
});

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function () {
  // Fetch all clock styles
  await BladesHelpers.loadAllClockStyles();

  // Determine whether a system migration is required
  const currentVersion = game.settings.get("beamsaber", "systemMigrationVersion");
  const NEEDS_MIGRATION_VERSION = 3.4;
  const needsMigration = currentVersion != null && currentVersion < NEEDS_MIGRATION_VERSION;

  // Perform the migration
  if (needsMigration && game.user.isGM)
    migrateWorld(currentVersion, NEEDS_MIGRATION_VERSION);
});

/*
 * Hooks
 */

// getSceneControlButtons
Hooks.on('getSceneControlButtons', controls => {
  controls.tokens.tools.DiceRoller = {
    name: "DiceRoller",
    title: "BITD.DiceRoller",
    icon: "fas fa-dice",
    button: true,
    onChange: () => {
      simpleRollPopup();
    }
  };
});

Hooks.on("renderChatMessageHTML", async (message, html, context) => {
  if (!message.isContentVisible) return;
  // Group Action Begin Message
  if (message.content.includes("roll-group-action")) {
    for (const button of html.querySelectorAll('.roll-group-action')) {
      button.addEventListener('click', async (_) => {
        let speakerFull = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
        let squadFull = BladesHelpers.resolveActor(message.system.groupActionSquad);
        if (!speakerFull)
          ui.notifications.warn(game.i18n.localize('BITD.log.warn.GroupActionRollNoActor'));
        else if (speakerFull.type != 'character')
          ui.notifications.warn(game.i18n.format('BITD.log.warn.GroupActionRollNotACharacter', { obj: game.i18n.localize(`TYPES.Actor.${speakerFull.type}`) }));
        else if (speakerFull.system.crew != squadFull?.uuid)
          ui.notifications.warn(game.i18n.format('BITD.log.warn.GroupActionRollCharacterNotInCrew', { char: speakerFull.name, crew: squadFull.name }));
        else
          speakerFull.rollAttributePopup(squadFull.system.group_action.action, squadFull.system.group_action);
      });
    }
    for (const button of html.querySelectorAll('.reveal-group-action-result'))
      button.addEventListener('click', async (_) => BladesHelpers.resolveActor(message.system.groupActionSquad)?.revealGroupActionResult());
  }
  for (const button of html.querySelectorAll('.work-hard-play-hard-roll'))
    button.addEventListener('click', async (ev) => {
      let element = ev.currentTarget;
      let speakerFull = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
      let otherCharacterFull = BladesHelpers.resolveActor(element.dataset.actorId);
      if (!speakerFull)
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.WorkHardPlayHardNoActor'));
      else if (speakerFull.uuid != element.dataset.actorId)
        ui.notifications.warn(game.i18n.format('BITD.log.warn.WorkHardPlayHardWrongActor', {name: otherCharacterFull.name, currentName: speakerFull.name}));
      else
        await speakerFull.workHardPlayHardRoll(element.dataset.originalActorId, element.dataset.result);
    });
  for (const button of html.querySelectorAll('.carouse-stress'))
    button.addEventListener('click', async (ev) => {
      const speakerFull = ChatMessage.getSpeakerActor(message.speaker);
      await cancelRollResult(message.system.rollData, speakerFull);
      message.system.rollData.carouseStress = true;
      let extraFields = { roll_type: 'cutLoose', modifiers: message.system.rollData.modifiers, actor: speakerFull, rollData: message.system.rollData };
      extraFields.connection = BladesHelpers.resolveActor(message.system.rollData.connectionUuid);
      extraFields.stress = Number(speakerFull.system.stress.value)
      await bladesRoll(0, 'BITD.CutLooseRoll', message.system.rollData.note, extraFields);
      await BladesHelpers.tryDelete(message);
    });
  for (const button of html.querySelectorAll('.carouse-pilot-connection'))
    button.addEventListener('click', async (ev) => {
      const speakerFull = ChatMessage.getSpeakerActor(message.speaker);
      await cancelRollResult(message.system.rollData, speakerFull);
      message.system.rollData.carousePilotRelationship = true;
      let extraFields = { roll_type: 'cutLoose', modifiers: message.system.rollData.modifiers, actor: speakerFull, rollData: message.system.rollData };
      extraFields.connection = BladesHelpers.resolveActor(message.system.rollData.connectionUuid);
      extraFields.stress = Number(speakerFull.system.stress.value)
      await bladesRoll(0, 'BITD.CutLooseRoll', message.system.rollData.note, extraFields);
      await BladesHelpers.tryDelete(message);
    });
  for (const button of html.querySelectorAll('.carouse-other-connection'))
    button.addEventListener('click', async (ev) => {
      const speakerFull = ChatMessage.getSpeakerActor(message.speaker);
      await cancelRollResult(message.system.rollData, speakerFull);
      message.system.rollData.carouseOtherRelationship = true;
      let extraFields = { roll_type: 'cutLoose', modifiers: message.system.rollData.modifiers, actor: speakerFull, rollData: message.system.rollData };
      extraFields.connection = BladesHelpers.resolveActor(message.system.rollData.connectionUuid);
      extraFields.stress = Number(speakerFull.system.stress.value)
      await bladesRoll(0, 'BITD.CutLooseRoll', message.system.rollData.note, extraFields);
      await BladesHelpers.tryDelete(message);
    });
});
