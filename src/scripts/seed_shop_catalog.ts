import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { connectDB, closeDB, getDatabaseName } from "../infrastructure/db/client";
import { ObjectId } from "mongodb";

async function seedShopCatalog() {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/nexora_marketplace_db";
  console.log(`Starting shop catalog seed for [${getDatabaseName()}]...`);
  const db = await connectDB(3, 1000);

  const STORE_ID = new ObjectId("65f1a1b1c1d1e1f1a1b1c001");
  const SELLER_ID = new ObjectId("65f1a1b1c1d1e1f1a1b1c002");

  // 1. Categories matching the reference design
  console.log("Seeding shop categories...");
  const categoriesCol = db.collection("categories");
  await categoriesCol.deleteMany({});

  const catDrinks = new ObjectId("66f000000000000000000001");
  const catEcoGarden = new ObjectId("66f000000000000000000002");
  const catFreshNuts = new ObjectId("66f000000000000000000003");
  const catFruits = new ObjectId("66f000000000000000000004");
  const catSpices = new ObjectId("66f000000000000000000005");
  const catMeat = new ObjectId("66f000000000000000000006");

  const categories = [
    { _id: catDrinks, name: "Drinks", slug: "drinks", is_active: true, sort_order: 1 },
    { _id: catEcoGarden, name: "Eco Garden", slug: "eco-garden", is_active: true, sort_order: 2 },
    { _id: catFreshNuts, name: "Fresh Nuts", slug: "fresh-nuts", is_active: true, sort_order: 3 },
    { _id: catFruits, name: "Fruits", slug: "fruits", is_active: true, sort_order: 4 },
    { _id: catSpices, name: "Spices", slug: "spices", is_active: true, sort_order: 5 },
    { _id: catMeat, name: "Meat & Seafood", slug: "meat-seafood", is_active: true, sort_order: 6 },
  ];
  await categoriesCol.insertMany(categories);

  // 2. Products (23 items matching the exact user reference catalog)
  console.log("Seeding 23 catalog products...");
  const productsCol = db.collection("products");
  await productsCol.deleteMany({});

  const rawProducts = [
    {
      name: "Banana Flavor Fruit",
      slug: "banana-flavor-fruit",
      category_id: catFruits,
      base_price: 9000, // $90.00
      compare_at_price: null,
      inventory_quantity: 0, // Out of Stock
      images: [
        "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=900&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Naturally sweet golden organic bananas harvested at peak ripeness. Packed with potassium, essential vitamins, and wholesome energy.",
      tags: ["fruits", "yellow", "1kg", "brand-1", "organic", "vegan", "hot"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 1" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: false,
      color_dots: ["#EF4444", "#22C55E"],
    },
    {
      name: "Berry Smoothie Concor",
      slug: "berry-smoothie-concor",
      category_id: catDrinks,
      base_price: 35000, // $350.00
      compare_at_price: null,
      inventory_quantity: 45,
      images: [
        "https://images.unsplash.com/photo-1537640538966-79f369143f8f?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Hand-picked green Concord grape and organic berry smoothie blend. Pure cold-pressed richness without added refined sugars.",
      tags: ["drinks", "green", "500g", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#22C55E"],
    },
    {
      name: "Cabbage Fresh",
      slug: "cabbage-fresh",
      category_id: catEcoGarden,
      base_price: 5000, // $50.00
      compare_at_price: 8000, // $80.00 (-38%)
      inventory_quantity: 80,
      images: [
        "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Crisp and dense farm-fresh green Savoy cabbage. Grown with zero synthetic fertilizers in certified regenerative organic soil.",
      tags: ["eco-garden", "green", "1kg", "brand-2", "organic", "vegan", "hot", "deal"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: true,
      discount_percent: 38,
      deal_seconds_left: 322 * 86400 + 6 * 3600 + 18 * 60 + 2,
      color_dots: ["#EF4444", "#F97316"],
    },
    {
      name: "Cherry Juice",
      slug: "cherry-juice",
      category_id: catDrinks,
      base_price: 12000, // $120.00
      compare_at_price: null,
      inventory_quantity: 65,
      images: [
        "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Pure green Bartlett pear and wild tart cherry cold-pressed organic nectar. Rich in natural antioxidants and rejuvenating electrolytes.",
      tags: ["drinks", "green", "500g", "brand-3", "organic", "vegan", "hot"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 3" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: false,
      color_dots: ["#F97316", "#22C55E"],
    },
    {
      name: "Coconut Juice",
      slug: "coconut-juice",
      category_id: catDrinks,
      base_price: 20000, // $200.00
      compare_at_price: null,
      inventory_quantity: 40,
      images: [
        "https://images.unsplash.com/photo-1544378730-8b5104b18790?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Raw tender green coconuts harvested young for pristine isotonic water and tender jelly-soft coconut meat.",
      tags: ["drinks", "green", "1kg", "brand-1", "organic", "vegan", "hot"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 1" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: true,
      has_deal: false,
      color_dots: ["#22C55E"],
    },
    {
      name: "Consectetuer Adipi",
      slug: "consectetuer-adipi",
      category_id: catEcoGarden,
      base_price: 1500, // $15.00
      compare_at_price: 7900, // $79.00 range
      inventory_quantity: 0, // Out of Stock
      images: [
        "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Buttery Hass avocados grown under coastal morning fog. Silky texture rich in heart-healthy monounsaturated fats.",
      tags: ["eco-garden", "green", "250g", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "250g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      price_range_display: "$15.00–$79.00",
      color_dots: ["#14B8A6", "#EC4899", "#EAB308"],
    },
    {
      name: "Eggs",
      slug: "farm-fresh-eggs",
      category_id: catEcoGarden,
      base_price: 7900, // $79.00
      compare_at_price: 9900,
      inventory_quantity: 110,
      images: [
        "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Pasture-raised free-range organic brown eggs with deep amber yolks from hens roaming open grassy meadows.",
      tags: ["eco-garden", "yellow", "500g", "brand-2", "organic", "hot", "deal"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: true,
      deal_seconds_left: 226 * 86400 + 6 * 3600 + 18 * 60 + 1,
      color_dots: ["#F97316", "#22C55E"],
    },
    {
      name: "Farm Vegetables",
      slug: "farm-vegetables-basket",
      category_id: catEcoGarden,
      base_price: 15000, // $150.00
      compare_at_price: null,
      inventory_quantity: 35,
      images: [
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Rustic artisan crate filled with seasonal root vegetables, heirloom tomatoes, crunchy carrots, and leeks.",
      tags: ["eco-garden", "red", "1kg", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Red" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#F97316", "#22C55E"],
    },
    {
      name: "Fresh Beef Meat",
      slug: "fresh-beef-meat",
      category_id: catMeat,
      base_price: 10000, // $100.00
      compare_at_price: null,
      inventory_quantity: 0, // Out of Stock
      images: [
        "https://images.unsplash.com/photo-1603048588665-791ca8aea617?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Grass-fed Prime Angus beef cuts with exquisite intra-muscular marbling, dry-aged for extraordinary tenderness.",
      tags: ["meat-seafood", "red", "1kg", "brand-3", "meat", "hot"],
      attributes: [
        { name: "Color", value: "Red" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 3" },
        { name: "Type", value: "Meat" },
      ],
      is_hot: true,
      has_deal: false,
      color_dots: ["#EF4444"],
    },
    {
      name: "Fresh Seafood",
      slug: "fresh-seafood-salmon",
      category_id: catMeat,
      base_price: 2500, // $25.00
      compare_at_price: 9000, // $90.00
      inventory_quantity: 50,
      images: [
        "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Wild-caught Alaskan king salmon fillets with fresh garden dill and organic lemon slices. High in Omega-3 EPA/DHA.",
      tags: ["meat-seafood", "pink", "500g", "brand-4", "meat"],
      attributes: [
        { name: "Color", value: "Pink" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Meat" },
      ],
      is_hot: false,
      has_deal: false,
      price_range_display: "$25.00–$90.00",
      color_dots: ["#000000", "#14B8A6", "#EF4444"],
    },
    {
      name: "Kale Bunch",
      slug: "kale-bunch-watermelon",
      category_id: catFruits,
      base_price: 15000, // $150.00
      compare_at_price: null,
      inventory_quantity: 45,
      images: [
        "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Sweet heirloom striped seeded watermelon with crisp, juicy crimson flesh that bursts with refreshing summer hydration.",
      tags: ["fruits", "green", "1kg", "brand-2", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Green" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#F97316", "#22C55E"],
    },
    {
      name: "Orange Juice",
      slug: "orange-juice-smoothie",
      category_id: catDrinks,
      base_price: 5000, // $50.00
      compare_at_price: 7900, // $79.00 (-37%)
      inventory_quantity: 60,
      images: [
        "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Creamy probiotic strawberry yogurt shake infused with Valencia orange zest and whole summer strawberries.",
      tags: ["drinks", "pink", "500g", "brand-1", "organic", "vegan", "hot", "deal"],
      attributes: [
        { name: "Color", value: "Pink" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 1" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: true,
      discount_percent: 37,
      deal_seconds_left: 322 * 86400 + 6 * 3600 + 18 * 60 + 1,
      color_dots: ["#F97316", "#22C55E"],
    },
    // Next 11 items to complete all 23 items matching the pagination (Page 2 + Filters)
    {
      name: "Organic Potato",
      slug: "organic-potato",
      category_id: catEcoGarden,
      base_price: 10000, // $100.00
      compare_at_price: 15000, // $150.00
      inventory_quantity: 120,
      images: [
        "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Golden Yukon organic potatoes. Buttery texture ideal for roasting, mashing, or hearty farm stews.",
      tags: ["eco-garden", "yellow", "1kg", "brand-2", "organic", "vegan", "hot"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "1kg" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: true,
      has_deal: false,
      color_dots: ["#EAB308"],
    },
    {
      name: "California Raw Almonds",
      slug: "california-raw-almonds",
      category_id: catFreshNuts,
      base_price: 4500, // $45.00
      compare_at_price: null,
      inventory_quantity: 70,
      images: [
        "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Unpasteurized nonpareil California almonds. Crunchy, nutrient-dense, and loaded with vitamin E and plant protein.",
      tags: ["fresh-nuts", "yellow", "250g", "brand-3", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "250g" },
        { name: "Brand", value: "Brand 3" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EAB308"],
    },
    {
      name: "Organic Cashew Nuts",
      slug: "organic-cashew-nuts",
      category_id: catFreshNuts,
      base_price: 6500, // $65.00
      compare_at_price: null,
      inventory_quantity: 50,
      images: [
        "https://images.unsplash.com/photo-1536591375315-1b8ea8941916?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Whole W320 jumbo raw cashews. Naturally creamy and sweet, perfect for dairy-free cheeses and wholesome snacking.",
      tags: ["fresh-nuts", "yellow", "200g", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "200g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EAB308"],
    },
    {
      name: "English Walnuts Shelled",
      slug: "english-walnuts-shelled",
      category_id: catFreshNuts,
      base_price: 8500, // $85.00
      compare_at_price: null,
      inventory_quantity: 40,
      images: [
        "https://images.unsplash.com/photo-1585849834908-3481231155e8?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Light amber walnut halves packed with brain-boosting ALA Omega-3 fatty acids and wholesome flavor.",
      tags: ["fresh-nuts", "yellow", "500g", "brand-1", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 1" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EAB308"],
    },
    {
      name: "Organic Ceylon Cinnamon",
      slug: "organic-ceylon-cinnamon",
      category_id: catSpices,
      base_price: 2500, // $25.00
      compare_at_price: null,
      inventory_quantity: 90,
      images: [
        "https://images.unsplash.com/photo-1509358271058-acd22cc93898?q=80&w=900&auto=format&fit=crop",
      ],
      description: "True Ceylon cinnamon quills directly from Sri Lankan family estates. Fragrant, delicate, and low in coumarin.",
      tags: ["spices", "red", "200g", "brand-2", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Red" },
        { name: "Weight", value: "200g" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EF4444"],
    },
    {
      name: "Tellicherry Black Peppercorns",
      slug: "tellicherry-black-peppercorns",
      category_id: catSpices,
      base_price: 1800, // $18.00
      compare_at_price: null,
      inventory_quantity: 80,
      images: [
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Extra bold aromatic black peppercorns from Malabar coast. Rich pungent heat with cedar and citrus undertones.",
      tags: ["spices", "black", "200g", "brand-3", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Black" },
        { name: "Weight", value: "200g" },
        { name: "Brand", value: "Brand 3" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#000000"],
    },
    {
      name: "Alleppey Turmeric Powder",
      slug: "alleppey-turmeric-powder",
      category_id: catSpices,
      base_price: 2200, // $22.00
      compare_at_price: null,
      inventory_quantity: 110,
      images: [
        "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Vibrant golden root powder with over 5% natural curcumin content. Potent anti-inflammatory culinary powerhouse.",
      tags: ["spices", "yellow", "250g", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Yellow" },
        { name: "Weight", value: "250g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EAB308"],
    },
    {
      name: "Organic Red Chili Flakes",
      slug: "organic-red-chili-flakes",
      category_id: catSpices,
      base_price: 1600, // $16.00
      compare_at_price: null,
      inventory_quantity: 75,
      images: [
        "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Sun-dried crushed red pepper flakes with seeds. Delivers warm tingling heat to pasta, pizza, and stir-fries.",
      tags: ["spices", "red", "200g", "brand-1", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Red" },
        { name: "Weight", value: "200g" },
        { name: "Brand", value: "Brand 1" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EF4444"],
    },
    {
      name: "Fresh Blueberries Punnet",
      slug: "fresh-blueberries-punnet",
      category_id: catFruits,
      base_price: 3500, // $35.00
      compare_at_price: null,
      inventory_quantity: 65,
      images: [
        "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Plump organic highbush blueberries bursting with antioxidant anthocyanins and sweet-tart berry bliss.",
      tags: ["fruits", "blue", "250g", "brand-2", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Blue" },
        { name: "Weight", value: "250g" },
        { name: "Brand", value: "Brand 2" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#3B82F6"],
    },
    {
      name: "Wild Organic Blackberries",
      slug: "wild-organic-blackberries",
      category_id: catFruits,
      base_price: 4200, // $42.00
      compare_at_price: null,
      inventory_quantity: 40,
      images: [
        "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Dark juicy bramble blackberries picked by hand in the early morning dew. Packed with dietary fiber.",
      tags: ["fruits", "black", "200g", "brand-4", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Black" },
        { name: "Weight", value: "200g" },
        { name: "Brand", value: "Brand 4" },
        { name: "Type", value: "Vegan" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#000000", "#3B82F6"],
    },
    {
      name: "Pink Pitaya Dragonfruit",
      slug: "pink-pitaya-dragonfruit",
      category_id: catFruits,
      base_price: 5500, // $55.00
      compare_at_price: null,
      inventory_quantity: 35,
      images: [
        "https://images.unsplash.com/photo-1527325678964-54921661f888?q=80&w=900&auto=format&fit=crop",
      ],
      description: "Exotic magenta dragonfruit with tender green scales and sweet seed-speckled ruby-pink pulp.",
      tags: ["fruits", "pink", "500g", "brand-3", "organic", "vegan"],
      attributes: [
        { name: "Color", value: "Pink" },
        { name: "Weight", value: "500g" },
        { name: "Brand", value: "Brand 3" },
        { name: "Type", value: "Organic" },
      ],
      is_hot: false,
      has_deal: false,
      color_dots: ["#EC4899"],
    },
  ];

  const docs = rawProducts.map((p, idx) => {
    const pId = new ObjectId();
    const variantId = new ObjectId();

    return {
      _id: pId,
      store_id: STORE_ID,
      seller_id: SELLER_ID,
      category_id: p.category_id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: "approved",
      images: p.images,
      tags: p.tags,
      attributes: p.attributes,
      variants: [
        {
          _id: variantId,
          sku: `SKU-${p.name.slice(0, 3).toUpperCase()}-${idx + 1}`,
          name: "Standard Pack",
          attributes: { size: p.attributes[1]?.value || "Standard", color: p.attributes[0]?.value || "Natural" },
          price: p.base_price,
          compare_at_price: p.compare_at_price,
          is_active: true,
        },
      ],
      base_price: p.base_price,
      compare_at_price: p.compare_at_price,
      inventory_quantity: p.inventory_quantity,
      rating_avg: idx % 3 === 0 ? 5.0 : idx % 3 === 1 ? 4.8 : 4.9,
      rating_count: 24 + idx * 7,
      total_sold: 85 + idx * 19,
      is_deleted: false,
      created_at: new Date(Date.now() - idx * 86400000),
      updated_at: new Date(),
      // Custom presentation fields
      is_hot: p.is_hot,
      has_deal: p.has_deal,
      discount_percent: (p as any).discount_percent || null,
      deal_seconds_left: (p as any).deal_seconds_left || null,
      price_range_display: (p as any).price_range_display || null,
      color_dots: (p as any).color_dots || [],
    };
  });

  await productsCol.insertMany(docs);
  console.log(`✅ Seeded ${categories.length} categories and ${docs.length} products successfully into [${getDatabaseName()}]!`);
  await closeDB();
}

seedShopCatalog().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
