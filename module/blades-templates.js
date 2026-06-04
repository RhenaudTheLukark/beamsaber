/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/beamsaber/templates/parts/attributes.html",
    "systems/beamsaber/templates/parts/cohort-block.html",
    "systems/beamsaber/templates/parts/active-effects.html",
    "systems/beamsaber/templates/parts/relationship-block.html",
    "systems/beamsaber/templates/parts/beliefs-block.html",
    "systems/beamsaber/templates/parts/trust-block.html",
    "systems/beamsaber/templates/parts/status-block.html",
    "systems/beamsaber/templates/parts/item_display/ability.html",
    "systems/beamsaber/templates/parts/item_display/crew_ability.html",
    "systems/beamsaber/templates/parts/item_display/crew_upgrade.html",
    "systems/beamsaber/templates/parts/item_display/item.html",
    "systems/beamsaber/templates/parts/item_display/vehicle_gear.html",

    // SVGs
    "systems/beamsaber/templates/svg/d20.hbs",
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
