(function (global) {
  "use strict";

  if (global.LuminousCookingRecipeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingRecipeCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "cooking_recipes";
  const CURRENCY = "AHN";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function economy() {
    return global.LuminousItemEconomyStandard || safeRequire("./item-economy-standard.js");
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function ingredient(requirement, role = "major", quantity = 1, options = {}) {
    return Object.freeze({
      requirement: normalizeId(requirement),
      role: normalizeId(role),
      quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
      optional: options.optional === true,
      notes: options.notes || "",
    });
  }

  function recipe(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: FAMILY,
      cuisine: normalizeId(def.cuisine || "general"),
      course: normalizeId(def.course || "main"),
      dishFamily: normalizeId(def.dishFamily || "prepared_food"),
      iconFamily: normalizeId(def.iconFamily || "") || null,
      method: normalizeId(def.method || "assemble"),
      ability: normalizeId(def.ability || "dex"),
      creationMultiplier: Number(def.creationMultiplier || 1.10),
      laborClass: normalizeId(def.laborClass || "standard"),
      priceClass: normalizeId(def.priceClass || "normal_meal"),
      defaultVenue: normalizeId(def.defaultVenue || "restaurant_standard"),
      ingredients: Object.freeze((def.ingredients || []).slice()),
      auxiliarySteps: Object.freeze((def.auxiliarySteps || []).map(normalizeId)),
      tags: Object.freeze((def.tags || []).map(normalizeId).filter(Boolean)),
      hungerRestore: Math.max(0, Number(def.hungerRestore ?? 1) || 0),
      hydrationRestore: Math.max(0, Number(def.hydrationRestore ?? 0) || 0),
      catalogStatus: def.catalogStatus || "master_v1",
    });
  }

  const I = ingredient;
  const R = recipe;

  const RECIPES = Object.freeze([
    // Bakery / pastry / breakfast
    R({id:"white_bread",name:"White Bread",iconFamily:"white_bread",cuisine:"bakery",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core")],tags:["bread","baked"]}),
    R({id:"rustic_bread",name:"Rustic Bread",iconFamily:"rustic_bread",cuisine:"bakery",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("grain","minor")],tags:["bread","baked"]}),
    R({id:"flatbread",name:"Flatbread",iconFamily:"flatbread",cuisine:"bakery",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.08,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core")],tags:["bread","flatbread"]}),
    R({id:"focaccia",name:"Focaccia",iconFamily:"focaccia",cuisine:"italian",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("oil","minor"),I("herb","seasoning")],tags:["bread","italian","savory"]}),
    R({id:"dinner_rolls",name:"Dinner Rolls",iconFamily:"dinner_rolls",cuisine:"bakery",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.12,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("fat","minor")],tags:["bread","baked"]}),
    R({id:"baguette",name:"Baguette",iconFamily:"baguette",cuisine:"bakery",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.12,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core")],tags:["bread","baked"]}),
    R({id:"pretzel",name:"Pretzel",iconFamily:"pretzel",cuisine:"bakery",course:"snack",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.12,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("seasoning","seasoning")],tags:["bread","snack"]}),
    R({id:"pancakes",name:"Pancakes",iconFamily:"pancakes",cuisine:"american",course:"breakfast",dishFamily:"breakfast",method:"pan_fry",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"diner",ingredients:[I("flour","core"),I("binder","major"),I("sweetener","minor")],tags:["breakfast","sweet"]}),
    R({id:"waffles",name:"Waffles",iconFamily:"waffles",cuisine:"american",course:"breakfast",dishFamily:"breakfast",method:"bake",ability:"dex",creationMultiplier:1.12,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"diner",ingredients:[I("flour","core"),I("binder","major"),I("sweetener","minor")],tags:["breakfast","sweet"]}),
    R({id:"crepes",name:"Crêpes",iconFamily:"crepes",cuisine:"pastry",course:"dessert",dishFamily:"pastry",method:"pan_fry",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("flour","core"),I("binder","major"),I("sweetener","minor")],tags:["pastry","sweet"]}),
    R({id:"cookies",name:"Cookies",cuisine:"pastry",course:"dessert",dishFamily:"pastry",method:"bake",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("flour","core"),I("sweetener","major"),I("fat","minor")],tags:["pastry","dessert"]}),
    R({id:"fruit_pie",name:"Fruit Pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("fruit","major",2),I("sweetener","minor")],tags:["pie","fruit","dessert"]}),
    R({id:"berry_pie",name:"Berry Pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("berry","major",2),I("sweetener","minor")],tags:["pie","berry","dessert"]}),

    // Pie / tart variants share the same baking chassis; the named filling selects the canonical output.
    R({id:"apple_pie",name:"Apple Pie",iconFamily:"apple_pie",cuisine:"american",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("apple","major",2),I("sweetener","minor"),I("spice","seasoning")],tags:["american","pie","apple","fruit","dessert"]}),
    R({id:"pear_pie",name:"Pear Pie",iconFamily:"pear_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("pear","major",2),I("sweetener","minor")],tags:["pie","pear","fruit","dessert"]}),
    R({id:"blackberry_pie",name:"Blackberry Pie",iconFamily:"blackberry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("blackberry","major",2),I("sweetener","minor")],tags:["pie","blackberry","berry","fruit","dessert"]}),
    R({id:"strawberry_pie",name:"Strawberry Pie",iconFamily:"strawberry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("strawberry","major",2),I("sweetener","minor")],tags:["pie","strawberry","berry","fruit","dessert"]}),
    R({id:"blueberry_pie",name:"Blueberry Pie",iconFamily:"blueberry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("blueberry","major",2),I("sweetener","minor")],tags:["pie","blueberry","berry","fruit","dessert"]}),
    R({id:"raspberry_pie",name:"Raspberry Pie",iconFamily:"raspberry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("raspberry","major",2),I("sweetener","minor")],tags:["pie","raspberry","berry","fruit","dessert"]}),
    R({id:"red_berry_pie",name:"Red Berry Pie",iconFamily:"red_berry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("red_berry","major",2),I("sweetener","minor")],tags:["pie","red_berry","berry","fruit","dessert"]}),
    R({id:"peach_pie",name:"Peach Pie",iconFamily:"peach_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("peach","major",2),I("sweetener","minor")],tags:["pie","peach","fruit","dessert"]}),
    R({id:"cherry_pie",name:"Cherry Pie",iconFamily:"cherry_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("cherry","major",2),I("sweetener","minor")],tags:["pie","cherry","fruit","dessert"]}),
    R({id:"plum_pie",name:"Plum Pie",iconFamily:"plum_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("plum","major",2),I("sweetener","minor")],tags:["pie","plum","fruit","dessert"]}),
    R({id:"banana_cream_pie",name:"Banana Cream Pie",iconFamily:"banana_cream_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("banana","major",2),I("cream","minor"),I("sweetener","minor")],tags:["pie","banana","cream","fruit","dessert"]}),
    R({id:"pineapple_pie",name:"Pineapple Pie",iconFamily:"pineapple_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("pineapple","major",2),I("sweetener","minor")],tags:["pie","pineapple","fruit","dessert"]}),
    R({id:"coconut_cream_pie",name:"Coconut Cream Pie",iconFamily:"coconut_cream_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("coconut","major",2),I("cream","minor"),I("sweetener","minor")],tags:["pie","coconut","cream","fruit","dessert"]}),
    R({id:"mango_pie",name:"Mango Pie",iconFamily:"mango_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("mango","major",2),I("sweetener","minor")],tags:["pie","mango","fruit","dessert"]}),
    R({id:"lemon_pie",name:"Lemon Pie",iconFamily:"lemon_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("lemon","major",2),I("sweetener","minor")],tags:["pie","lemon","citrus","fruit","dessert"]}),
    R({id:"lime_pie",name:"Lime Pie",iconFamily:"lime_pie",cuisine:"pastry",course:"dessert",dishFamily:"pie",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("lime","major",2),I("sweetener","minor")],tags:["pie","lime","citrus","fruit","dessert"]}),
    R({id:"orange_tart",name:"Orange Tart",iconFamily:"orange_tart",cuisine:"pastry",course:"dessert",dishFamily:"tart",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("orange","major",2),I("sweetener","minor")],tags:["tart","orange","citrus","fruit","dessert"]}),
    R({id:"kiwi_tart",name:"Kiwi Tart",iconFamily:"kiwi_tart",cuisine:"pastry",course:"dessert",dishFamily:"tart",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("kiwi","major",2),I("sweetener","minor")],tags:["tart","kiwi","fruit","dessert"]}),
    R({id:"dragon_fruit_tart",name:"Dragon Fruit Tart",iconFamily:"dragon_fruit_tart",cuisine:"pastry",course:"dessert",dishFamily:"tart",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("dough","core"),I("dragon_fruit","major",2),I("sweetener","minor")],tags:["tart","dragon_fruit","fruit","dessert","exotic"]}),
    R({id:"pomegranate_tart",name:"Pomegranate Tart",iconFamily:"pomegranate_tart",cuisine:"pastry",course:"dessert",dishFamily:"tart",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("pomegranate","major",2),I("sweetener","minor")],tags:["tart","pomegranate","fruit","dessert"]}),

    // Cake variants share the cake chassis; the named ingredient selects the canonical output.
    R({id:"cake",name:"Cake",iconFamily:"cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("sweetener","major"),I("binder","major"),I("fat","minor")],tags:["cake","dessert"]}),
    R({id:"fruit_cake",name:"Fruit Cake",iconFamily:"fruit_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("fruit","major",2),I("sweetener","major"),I("binder","minor")],tags:["cake","fruit","dessert"]}),
    R({id:"apple_cake",name:"Apple Cake",iconFamily:"apple_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("apple","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","apple","fruit","dessert"]}),
    R({id:"strawberry_cake",name:"Strawberry Cake",iconFamily:"strawberry_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("strawberry","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","strawberry","berry","fruit","dessert"]}),
    R({id:"blueberry_cake",name:"Blueberry Cake",iconFamily:"blueberry_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("blueberry","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","blueberry","berry","fruit","dessert"]}),
    R({id:"raspberry_cake",name:"Raspberry Cake",iconFamily:"raspberry_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("raspberry","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","raspberry","berry","fruit","dessert"]}),
    R({id:"banana_cake",name:"Banana Cake",iconFamily:"banana_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("banana","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","banana","fruit","dessert"]}),
    R({id:"peach_cake",name:"Peach Cake",iconFamily:"peach_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("peach","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","peach","fruit","dessert"]}),
    R({id:"pineapple_cake",name:"Pineapple Cake",iconFamily:"pineapple_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("pineapple","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","pineapple","fruit","dessert"]}),
    R({id:"blackberry_cake",name:"Blackberry Cake",iconFamily:"blackberry_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("blackberry","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","blackberry","berry","fruit","dessert"]}),
    R({id:"cherry_cake",name:"Cherry Cake",iconFamily:"cherry_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("cherry","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","cherry","fruit","dessert"]}),
    R({id:"coconut_cake",name:"Coconut Cake",iconFamily:"coconut_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("coconut","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","coconut","fruit","dessert"]}),
    R({id:"mango_cake",name:"Mango Cake",iconFamily:"mango_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("mango","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","mango","fruit","dessert"]}),
    R({id:"lemon_cake",name:"Lemon Cake",iconFamily:"lemon_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("lemon","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","lemon","citrus","fruit","dessert"]}),
    R({id:"orange_cake",name:"Orange Cake",iconFamily:"orange_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("orange","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","orange","citrus","fruit","dessert"]}),
    R({id:"chocolate_cake",name:"Chocolate Cake",iconFamily:"chocolate_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.27,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("cacao","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","chocolate","cacao","dessert"]}),
    R({id:"coffee_cake",name:"Coffee Cake",iconFamily:"coffee_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.27,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("coffee_bean","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","coffee","dessert"]}),
    R({id:"carrot_cake",name:"Carrot Cake",iconFamily:"carrot_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("carrot","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","carrot","vegetable","dessert"]}),
    R({id:"pumpkin_cake",name:"Pumpkin Cake",iconFamily:"pumpkin_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("pumpkin","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","pumpkin","vegetable","dessert"]}),
    R({id:"honey_cake",name:"Honey Cake",iconFamily:"honey_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("honey","major"),I("binder","minor"),I("fat","minor")],tags:["cake","honey","sweet","dessert"]}),
    R({id:"chestnut_cake",name:"Chestnut Cake",iconFamily:"chestnut_cake",cuisine:"pastry",course:"dessert",dishFamily:"cake",method:"bake",ability:"dex",creationMultiplier:1.27,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("flour","core"),I("chestnut","major"),I("sweetener","major"),I("binder","minor"),I("fat","minor")],tags:["cake","chestnut","nut","dessert"]}),
    R({id:"muffin",name:"Muffin",cuisine:"pastry",course:"dessert",dishFamily:"pastry",method:"bake",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("flour","core"),I("sweetener","minor"),I("binder","minor")],tags:["pastry","dessert"]}),
    R({id:"donut",name:"Donut",cuisine:"american",course:"dessert",dishFamily:"fried_pastry",method:"deep_fry",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("oil","major"),I("sweetener","minor")],tags:["american","fried","dessert"]}),
    R({id:"fruit_tart",name:"Fruit Tart",cuisine:"pastry",course:"dessert",dishFamily:"tart",method:"bake",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"bakery",ingredients:[I("dough","core"),I("fruit","major",2),I("sweetener","minor")],tags:["tart","fruit","dessert"]}),
    R({id:"sweet_roll",name:"Sweet Roll",cuisine:"pastry",course:"dessert",dishFamily:"pastry",method:"bake",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"bakery",ingredients:[I("dough","core"),I("sweetener","major"),I("spice","seasoning")],tags:["pastry","sweet"]}),

    // American / diner / general comfort food
    R({id:"burger",name:"Burger",cuisine:"american",course:"main",dishFamily:"sandwich",method:"grill",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("bread","core"),I("meat","major"),I("vegetable","minor"),I("sauce_base","seasoning")],tags:["american","burger","savory"]}),
    R({id:"cheeseburger",name:"Cheeseburger",cuisine:"american",course:"main",dishFamily:"sandwich",method:"grill",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("bread","core"),I("meat","major"),I("cheese","major"),I("vegetable","minor"),I("sauce_base","seasoning")],tags:["american","burger","cheese"]}),
    R({id:"hot_dog",name:"Hot Dog",cuisine:"american",course:"main",dishFamily:"sandwich",method:"grill",ability:"dex",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"street_stall",ingredients:[I("bread","core"),I("processed_meat","major"),I("sauce_base","seasoning")],tags:["american","street_food"]}),
    R({id:"fried_chicken",name:"Fried Chicken",cuisine:"american",course:"main",dishFamily:"fried_meat",method:"deep_fry",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("avian_meat","core"),I("coating","minor"),I("oil","major")],tags:["american","fried","meat"]}),
    R({id:"bbq_meat",name:"Barbecue Meat",cuisine:"american",course:"main",dishFamily:"barbecue",method:"grill",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("sauce_base","major"),I("spice","seasoning")],tags:["american","bbq","meat"]}),
    R({id:"smoked_bbq",name:"Smoked Barbecue",cuisine:"american",course:"main",dishFamily:"barbecue",method:"smoke",ability:"wis",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("meat","core",2),I("sauce_base","major"),I("spice","seasoning")],tags:["american","bbq","smoked"]}),
    R({id:"meatloaf",name:"Meatloaf",cuisine:"american",course:"main",dishFamily:"baked_meat",method:"bake",ability:"wis",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"diner",ingredients:[I("ground_meat","core"),I("aromatic","minor"),I("binder","minor")],tags:["american","comfort_food"]}),
    R({id:"mac_and_cheese",name:"Mac & Cheese",cuisine:"american",course:"main",dishFamily:"pasta",method:"bake",ability:"wis",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"diner",ingredients:[I("pasta","core"),I("cheese","major"),I("sauce_base","major")],tags:["american","pasta","cheese"]}),
    R({id:"mashed_potatoes",name:"Mashed Potatoes",cuisine:"american",course:"side",dishFamily:"vegetable_side",method:"mixing",ability:"dex",creationMultiplier:1.08,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"diner",ingredients:[I("potato","core",2),I("fat","minor")],tags:["american","side"]}),
    R({id:"roasted_potatoes",name:"Roasted Potatoes",cuisine:"general",course:"side",dishFamily:"vegetable_side",method:"roast",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("potato","core",2),I("oil","minor"),I("seasoning","seasoning")],tags:["side","roasted"]}),
    R({id:"fried_potatoes",name:"Fried Potatoes",cuisine:"american",course:"side",dishFamily:"fried_side",method:"deep_fry",ability:"dex",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("potato","core",2),I("oil","major")],tags:["american","fried","side"]}),
    R({id:"vegetable_soup",name:"Vegetable Soup",cuisine:"general",course:"main",dishFamily:"soup",method:"simmer",ability:"wis",creationMultiplier:1.12,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"diner",ingredients:[I("stock","core"),I("vegetable","major",2),I("aromatic","seasoning")],tags:["soup","vegetable"]}),
    R({id:"meat_stew",name:"Meat Stew",cuisine:"general",course:"main",dishFamily:"stew",method:"simmer",ability:"wis",creationMultiplier:1.18,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("stock","major"),I("vegetable","minor",2),I("aromatic","seasoning")],tags:["stew","meat"]}),
    R({id:"grilled_steak",name:"Grilled Steak",cuisine:"general",course:"main",dishFamily:"grilled_meat",method:"grill",ability:"dex",creationMultiplier:1.20,laborClass:"standard",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("meat","core"),I("seasoning","seasoning")],tags:["steak","grilled","meat"]}),
    R({id:"roast_meat",name:"Roast Meat",cuisine:"general",course:"main",dishFamily:"roast",method:"roast",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("aromatic","minor"),I("herb","seasoning")],tags:["roast","meat"]}),

    // Japanese
    R({id:"sushi_roll",name:"Sushi Roll",cuisine:"japanese",course:"main",dishFamily:"sushi",method:"assemble",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"specialty_food_shop",ingredients:[I("rice","core"),I("fish","major"),I("seaweed","minor"),I("vegetable","minor")],tags:["japanese","sushi"]}),
    R({id:"nigiri",name:"Nigiri",cuisine:"japanese",course:"main",dishFamily:"sushi",method:"assemble",ability:"dex",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("rice","core"),I("fish","major")],tags:["japanese","sushi"]}),
    R({id:"onigiri",name:"Onigiri",cuisine:"japanese",course:"snack",dishFamily:"rice_snack",method:"assemble",ability:"dex",creationMultiplier:1.08,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"specialty_food_shop",ingredients:[I("rice","core"),I("filling","minor"),I("seaweed","garnish")],tags:["japanese","rice","snack"]}),
    R({id:"ramen",name:"Ramen",cuisine:"japanese",course:"main",dishFamily:"noodle_soup",method:"simmer",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("noodles","core"),I("stock","major"),I("protein","minor"),I("vegetable","minor"),I("seasoning","seasoning")],tags:["japanese","noodles","soup"]}),
    R({id:"udon",name:"Udon",cuisine:"japanese",course:"main",dishFamily:"noodle_soup",method:"simmer",ability:"wis",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("noodles","core"),I("stock","major"),I("vegetable","minor")],tags:["japanese","noodles"]}),
    R({id:"soba",name:"Soba",cuisine:"japanese",course:"main",dishFamily:"noodles",method:"basic_boil",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("noodles","core"),I("sauce_base","major"),I("herb","garnish")],tags:["japanese","noodles"]}),
    R({id:"tempura",name:"Tempura",cuisine:"japanese",course:"main",dishFamily:"fried_food",method:"deep_fry",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("vegetable_or_seafood","core",2),I("coating","minor"),I("oil","major")],tags:["japanese","fried"]}),
    R({id:"yakitori",name:"Yakitori",cuisine:"japanese",course:"main",dishFamily:"grilled_meat",method:"grill",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"street_stall",ingredients:[I("avian_meat","core"),I("sauce_base","minor")],tags:["japanese","grilled","street_food"]}),
    R({id:"teriyaki_meat",name:"Teriyaki Meat",cuisine:"japanese",course:"main",dishFamily:"grilled_meat",method:"grill",ability:"wis",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("sauce_base","major"),I("sweetener","seasoning")],tags:["japanese","teriyaki"]}),
    R({id:"japanese_curry",name:"Japanese Curry",cuisine:"japanese",course:"main",dishFamily:"curry",method:"simmer",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("rice","core"),I("meat_or_vegetable","major"),I("vegetable","minor",2),I("sauce_base","major")],tags:["japanese","curry"]}),
    R({id:"miso_soup",name:"Miso Soup",cuisine:"japanese",course:"soup",dishFamily:"soup",method:"simmer",ability:"wis",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("stock","core"),I("miso_paste","major"),I("seaweed","minor")],tags:["japanese","soup"]}),
    R({id:"okonomiyaki",name:"Okonomiyaki",cuisine:"japanese",course:"main",dishFamily:"savory_pancake",method:"pan_fry",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"street_stall",ingredients:[I("batter","core"),I("vegetable","major"),I("protein","minor"),I("sauce_base","seasoning")],tags:["japanese","pan_fried"]}),
    R({id:"tonkatsu",name:"Tonkatsu",cuisine:"japanese",course:"main",dishFamily:"fried_meat",method:"deep_fry",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("coating","minor"),I("oil","major"),I("sauce_base","seasoning")],tags:["japanese","fried","meat"]}),
    R({id:"rice_bowl",name:"Rice Bowl",cuisine:"japanese",course:"main",dishFamily:"rice_bowl",method:"assemble",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("rice","core"),I("protein_or_vegetable","major"),I("sauce_base","minor")],tags:["japanese","rice_bowl"]}),

    // Italian
    R({id:"pizza_margherita",name:"Pizza Margherita",cuisine:"italian",course:"main",dishFamily:"pizza",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("dough","core"),I("sauce_base","major"),I("cheese","major"),I("herb","seasoning")],tags:["italian","pizza"]}),
    R({id:"meat_pizza",name:"Meat Pizza",cuisine:"italian",course:"main",dishFamily:"pizza",method:"bake",ability:"dex",creationMultiplier:1.22,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("dough","core"),I("sauce_base","major"),I("meat","major"),I("cheese","major")],tags:["italian","pizza","meat"]}),
    R({id:"vegetable_pizza",name:"Vegetable Pizza",cuisine:"italian",course:"main",dishFamily:"pizza",method:"bake",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("dough","core"),I("sauce_base","major"),I("vegetable","major",2),I("cheese","minor")],tags:["italian","pizza","vegetable"]}),
    R({id:"pasta_pomodoro",name:"Pasta al Pomodoro",cuisine:"italian",course:"main",dishFamily:"pasta",method:"simmer",ability:"wis",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("pasta","core"),I("sauce_base","major"),I("herb","seasoning")],tags:["italian","pasta"]}),
    R({id:"pasta_bolognese",name:"Pasta Bolognese",cuisine:"italian",course:"main",dishFamily:"pasta",method:"simmer",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("pasta","core"),I("meat","major"),I("sauce_base","major"),I("aromatic","minor")],tags:["italian","pasta","meat"]}),
    R({id:"carbonara",name:"Carbonara",cuisine:"italian",course:"main",dishFamily:"pasta",method:"mixing",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("pasta","core"),I("protein","major"),I("egg","major"),I("cheese","major")],tags:["italian","pasta"]}),
    R({id:"lasagna",name:"Lasagna",cuisine:"italian",course:"main",dishFamily:"baked_pasta",method:"bake",ability:"wis",creationMultiplier:1.25,laborClass:"elaborate",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("pasta","core"),I("sauce_base","major"),I("meat","major"),I("cheese","major")],tags:["italian","pasta","baked"]}),
    R({id:"risotto",name:"Risotto",cuisine:"italian",course:"main",dishFamily:"rice",method:"simmer",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("rice","core"),I("stock","major"),I("aromatic","minor"),I("cheese","minor")],tags:["italian","rice"]}),
    R({id:"minestrone",name:"Minestrone",cuisine:"italian",course:"main",dishFamily:"soup",method:"simmer",ability:"wis",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("stock","core"),I("vegetable","major",2),I("legume","minor"),I("herb","seasoning")],tags:["italian","soup"]}),
    R({id:"italian_meatballs",name:"Italian Meatballs",cuisine:"italian",course:"main",dishFamily:"meatballs",method:"pan_fry",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("ground_meat","core"),I("herb","seasoning"),I("binder","minor"),I("sauce_base","major")],tags:["italian","meat"]}),
    R({id:"bruschetta",name:"Bruschetta",cuisine:"italian",course:"appetizer",dishFamily:"bread_appetizer",method:"assemble",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("bread","core"),I("tomato","major"),I("herb","seasoning"),I("oil","minor")],tags:["italian","appetizer"]}),
    R({id:"polenta",name:"Polenta",cuisine:"italian",course:"side",dishFamily:"grain",method:"simmer",ability:"wis",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("corn","core"),I("stock","minor")],tags:["italian","grain"]}),
    R({id:"tiramisu",name:"Tiramisu",cuisine:"italian",course:"dessert",dishFamily:"dessert",method:"assemble",ability:"dex",creationMultiplier:1.30,laborClass:"fine",priceClass:"luxury_meal",defaultVenue:"restaurant_upscale",ingredients:[I("baked_base","core"),I("cream","major"),I("sweetener","major"),I("brew_base","minor")],tags:["italian","dessert","fine"]}),
    R({id:"panna_cotta",name:"Panna Cotta",cuisine:"italian",course:"dessert",dishFamily:"dessert",method:"delicate",ability:"int",creationMultiplier:1.30,laborClass:"fine",priceClass:"good_restaurant",defaultVenue:"restaurant_upscale",ingredients:[I("cream","core"),I("sweetener","major"),I("binder","minor")],tags:["italian","dessert","delicate"]}),

    // Mexican / Latin
    R({id:"tacos",name:"Tacos",cuisine:"mexican",course:"main",dishFamily:"taco",method:"assemble",ability:"dex",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"street_stall",ingredients:[I("flatbread","core"),I("meat_or_vegetable","major"),I("aromatic","minor"),I("sauce_base","seasoning")],tags:["mexican","street_food"]}),
    R({id:"quesadilla",name:"Quesadilla",cuisine:"mexican",course:"main",dishFamily:"flatbread",method:"pan_fry",ability:"dex",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"street_stall",ingredients:[I("flatbread","core"),I("cheese","major"),I("filling","minor")],tags:["mexican","cheese"]}),
    R({id:"burrito",name:"Burrito",cuisine:"mexican",course:"main",dishFamily:"wrapped_meal",method:"assemble",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("flatbread","core"),I("rice","major"),I("legume","major"),I("filling","major"),I("sauce_base","minor")],tags:["mexican","wrapped"]}),
    R({id:"enchiladas",name:"Enchiladas",cuisine:"mexican",course:"main",dishFamily:"baked_flatbread",method:"bake",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("flatbread","core"),I("filling","major"),I("sauce_base","major"),I("cheese","minor")],tags:["mexican","baked"]}),
    R({id:"tamales",name:"Tamales",cuisine:"mexican",course:"main",dishFamily:"steamed_dough",method:"steam",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"street_stall",ingredients:[I("corn_dough","core"),I("filling","major"),I("seasoning","seasoning")],tags:["mexican","steamed"]}),
    R({id:"chili_stew",name:"Chili",cuisine:"mexican_american",course:"main",dishFamily:"stew",method:"simmer",ability:"wis",creationMultiplier:1.18,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"diner",ingredients:[I("meat","core"),I("legume","major"),I("chili_pepper","seasoning"),I("tomato","minor")],tags:["stew","spicy"]}),
    R({id:"salsa",name:"Salsa",cuisine:"mexican",course:"condiment",dishFamily:"sauce",method:"mixing",ability:"dex",creationMultiplier:1.08,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"specialty_food_shop",ingredients:[I("tomato","core"),I("chili_pepper","minor"),I("aromatic","minor")],tags:["mexican","sauce"]}),
    R({id:"guacamole",name:"Guacamole",cuisine:"mexican",course:"side",dishFamily:"dip",method:"mixing",ability:"dex",creationMultiplier:1.10,laborClass:"simple",priceClass:"normal_meal",defaultVenue:"specialty_food_shop",ingredients:[I("rich_fruit","core"),I("aromatic","minor"),I("citrus","seasoning")],tags:["mexican","dip"]}),
    R({id:"rice_and_beans",name:"Rice & Beans",cuisine:"latin",course:"main",dishFamily:"rice_legume",method:"simmer",ability:"wis",creationMultiplier:1.10,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"diner",ingredients:[I("rice","core"),I("legume","major"),I("seasoning","seasoning")],tags:["latin","staple"]}),
    R({id:"grilled_fajitas",name:"Fajitas",cuisine:"mexican",course:"main",dishFamily:"stir_fry",method:"stir_fry",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("vegetable","major",2),I("spice","seasoning")],tags:["mexican","stir_fry"]}),

    // East Asian
    R({id:"fried_rice",name:"Fried Rice",cuisine:"east_asian",course:"main",dishFamily:"rice",method:"stir_fry",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("rice","core"),I("vegetable","major"),I("protein","minor"),I("sauce_base","minor")],tags:["east_asian","rice","stir_fry"]}),
    R({id:"stir_fried_noodles",name:"Stir-Fried Noodles",cuisine:"east_asian",course:"main",dishFamily:"noodles",method:"stir_fry",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("noodles","core"),I("vegetable","major"),I("protein","minor"),I("sauce_base","minor")],tags:["east_asian","noodles"]}),
    R({id:"dumplings",name:"Dumplings",cuisine:"east_asian",course:"main",dishFamily:"dumpling",method:"steam",ability:"dex",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"specialty_food_shop",ingredients:[I("dough","core"),I("filling","major")],tags:["east_asian","dumpling"]}),
    R({id:"spring_rolls",name:"Spring Rolls",cuisine:"east_asian",course:"appetizer",dishFamily:"fried_wrapper",method:"deep_fry",ability:"dex",creationMultiplier:1.18,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"takeaway_fast_food",ingredients:[I("wrapper","core"),I("vegetable_or_meat","major"),I("oil","major")],tags:["east_asian","fried"]}),
    R({id:"sweet_sour_meat",name:"Sweet & Sour Meat",cuisine:"east_asian",course:"main",dishFamily:"stir_fry",method:"stir_fry",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_standard",ingredients:[I("meat","core"),I("sauce_base","major"),I("sweetener","minor"),I("vegetable","minor")],tags:["east_asian","sweet_sour"]}),
    R({id:"vegetable_stir_fry",name:"Vegetable Stir Fry",cuisine:"east_asian",course:"main",dishFamily:"stir_fry",method:"stir_fry",ability:"dex",creationMultiplier:1.15,laborClass:"standard",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("vegetable","core",3),I("sauce_base","major")],tags:["east_asian","vegetable"]}),

    // South Asian
    R({id:"curry",name:"Curry",cuisine:"south_asian",course:"main",dishFamily:"curry",method:"simmer",ability:"wis",creationMultiplier:1.20,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("meat_or_vegetable","core"),I("sauce_base","major"),I("spice","major"),I("aromatic","minor")],tags:["south_asian","curry"]}),
    R({id:"dal",name:"Dal",cuisine:"south_asian",course:"main",dishFamily:"legume_stew",method:"simmer",ability:"wis",creationMultiplier:1.15,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("legume","core",2),I("spice","minor"),I("aromatic","minor")],tags:["south_asian","legume"]}),
    R({id:"naan",name:"Naan",cuisine:"south_asian",course:"staple",dishFamily:"bread",method:"bake",ability:"dex",creationMultiplier:1.12,laborClass:"standard",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("dough","core"),I("fat","minor")],tags:["south_asian","bread"]}),
    R({id:"spiced_rice",name:"Spiced Rice",cuisine:"south_asian",course:"main",dishFamily:"rice",method:"simmer",ability:"wis",creationMultiplier:1.12,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"restaurant_standard",ingredients:[I("rice","core"),I("spice","minor"),I("aromatic","minor")],tags:["south_asian","rice"]}),
    R({id:"tandoori_meat",name:"Tandoori-style Meat",cuisine:"south_asian",course:"main",dishFamily:"roast",method:"roast",ability:"wis",creationMultiplier:1.22,laborClass:"complex",priceClass:"good_restaurant",defaultVenue:"restaurant_good",ingredients:[I("meat","core"),I("spice","major"),I("binder","minor")],tags:["south_asian","roast","meat"]}),
    R({id:"vegetable_curry",name:"Vegetable Curry",cuisine:"south_asian",course:"main",dishFamily:"curry",method:"simmer",ability:"wis",creationMultiplier:1.18,laborClass:"complex",priceClass:"normal_meal",defaultVenue:"restaurant_standard",ingredients:[I("vegetable","core",2),I("sauce_base","major"),I("spice","major")],tags:["south_asian","curry","vegetable"]}),

    // Low-cost City survival foods
    R({id:"ration_block",name:"Ration Block",cuisine:"city_survival",course:"main",dishFamily:"ration",method:"assemble",ability:"dex",creationMultiplier:1.05,laborClass:"snack",priceClass:"survival",defaultVenue:"grocery_prepared",ingredients:[I("ration_base","core")],tags:["survival","ration","backstreets"]}),
    R({id:"cheap_noodle_cup",name:"Cheap Noodle Cup",cuisine:"city_survival",course:"main",dishFamily:"noodle_soup",method:"basic_boil",ability:"dex",creationMultiplier:1.05,laborClass:"snack",priceClass:"survival",defaultVenue:"street_stall",ingredients:[I("noodles","core"),I("broth_base","minor")],tags:["survival","backstreets","cheap"]}),
    R({id:"dubious_stew",name:"Dubious Stew",cuisine:"city_survival",course:"main",dishFamily:"stew",method:"simmer",ability:"wis",creationMultiplier:1.05,laborClass:"simple",priceClass:"survival",defaultVenue:"street_stall",ingredients:[I("low_grade_protein","core"),I("vegetable","minor"),I("broth_base","major")],tags:["survival","backstreets","cheap"]}),
    R({id:"stale_bread_meal",name:"Stale Bread Meal",cuisine:"city_survival",course:"main",dishFamily:"ration",method:"assemble",ability:"dex",creationMultiplier:1.05,laborClass:"snack",priceClass:"survival",defaultVenue:"grocery_prepared",ingredients:[I("bread","core")],tags:["survival","backstreets","cheap"]}),
    R({id:"recycled_protein_bowl",name:"Recycled Protein Bowl",cuisine:"city_survival",course:"main",dishFamily:"rice_bowl",method:"assemble",ability:"dex",creationMultiplier:1.08,laborClass:"simple",priceClass:"cheap_meal",defaultVenue:"street_stall",ingredients:[I("grain","core"),I("low_grade_protein","major"),I("sauce_base","minor")],tags:["survival","backstreets","protein"]})
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(RECIPES.map((entry) => [entry.id, entry])));

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function get(id) {
    const row = BY_ID[normalizeId(id)];
    return row ? clone(row) : null;
  }

  function list(options = {}) {
    const cuisine = normalizeId(options.cuisine);
    const course = normalizeId(options.course);
    const family = normalizeId(options.dishFamily);
    return RECIPES
      .filter((entry) => !cuisine || entry.cuisine === cuisine)
      .filter((entry) => !course || entry.course === course)
      .filter((entry) => !family || entry.dishFamily === family)
      .map(clone);
  }

  function inputProductionValueAhn(inputs = []) {
    return (Array.isArray(inputs) ? inputs : []).reduce((sum, row) => {
      const quantity = Math.max(0, Number(row?.quantity ?? 1) || 0);
      const unit = Number(
        row?.unitProductionValueAhn ??
        row?.productionValueAhn ??
        row?.unitValueAhn ??
        row?.standardUnitValueAhn ??
        row?.priceAhn ??
        0
      );
      return sum + (Number.isFinite(unit) && unit > 0 ? unit * quantity : 0);
    }, 0);
  }

  function resolveReferencePricing(recipeOrId, inputs = [], options = {}) {
    const entry = typeof recipeOrId === "string" ? get(recipeOrId) : clone(recipeOrId);
    if (!entry) return null;
    const econ = economy();
    const inputValue = inputProductionValueAhn(inputs);
    const stars = Math.max(1, Math.min(5, Math.round(Number(options.stars) || 3)));
    const venue = normalizeId(options.venue || entry.defaultVenue || "restaurant_standard");

    const created = econ?.dishCreatedProductionValue
      ? econ.dishCreatedProductionValue(inputValue, entry.creationMultiplier, entry.laborClass)
      : Math.round(inputValue * entry.creationMultiplier);
    const realized = econ?.realizedFoodValue ? econ.realizedFoodValue(created, stars) : created;
    const retail = econ?.venuePrice ? econ.venuePrice(realized, venue) : realized;
    const band = econ?.FOOD_PRICE_BANDS?.[entry.priceClass] || null;

    return Object.freeze({
      recipeId: entry.id,
      inputProductionValueAhn: inputValue,
      creationMultiplier: entry.creationMultiplier,
      laborClass: entry.laborClass,
      laborValueAhn: econ?.dishLaborValueAhn ? econ.dishLaborValueAhn(entry.laborClass) : null,
      createdProductionValueAhn: created,
      stars,
      qualityValueMultiplier: econ?.STAR_VALUE_MULTIPLIER?.[stars] ?? 1,
      realizedProductionValueAhn: realized,
      venue,
      venueMultiplier: econ?.VENUE_MULTIPLIER?.[venue] ?? 1,
      retailReferencePriceAhn: retail,
      priceClass: entry.priceClass,
      targetReferenceBandAhn: band ? Object.freeze({ minAhn:band.minAhn, maxAhn:band.maxAhn }) : null,
      referenceMonthlyWageAhn: econ?.REFERENCE_MONTHLY_WAGE_AHN || 1000000,
      monthlyAffordability: econ?.monthlyAffordability ? econ.monthlyAffordability(retail) : null,
    });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    RECIPES,
    normalizeId,
    get,
    list,
    inputProductionValueAhn,
    resolveReferencePricing,
  });

  global.LuminousCookingRecipeCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
