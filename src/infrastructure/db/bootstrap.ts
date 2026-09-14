import { Db, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { logger } from "../logger";

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("Password123!", 10);

export async function bootstrapDatabase(db: Db, force = false): Promise<void> {
  try {
    const usersCol = db.collection("users");
    const storesCol = db.collection("stores");
    const categoriesCol = db.collection("categories");
    const productsCol = db.collection("products");

    if (force) {
      logger.info("Force flag enabled: clearing collections in database...");
      await Promise.all([
        usersCol.deleteMany({}),
        storesCol.deleteMany({}),
        categoriesCol.deleteMany({}),
        productsCol.deleteMany({}),
      ]);
    }

    // 1. Check & Seed Users
    logger.info("Verifying and upserting Zevo default users into MongoDB...");
    const defaultUsers = [
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c010"),
        email: "support@nexora.com",
        first_name: "Nexora",
        last_name: "Support Desk",
        role: "SUPPORT",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000009",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c001"),
        email: "admin@zevo.com",
        first_name: "Zevo",
        last_name: "Admin",
        role: "ADMIN",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000001",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c002"),
        email: "seller@zevo.com",
        first_name: "David",
        last_name: "Merchant",
        role: "SELLER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000002",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c003"),
        email: "customer@zevo.com",
        first_name: "Alex",
        last_name: "Customer",
        role: "CUSTOMER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000003",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c004"),
        email: "rider@zevo.com",
        first_name: "Sam",
        last_name: "Courier",
        role: "DELIVERY_AGENT",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000004",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c008"),
        email: "superadmin@zevo.com",
        first_name: "Executive",
        last_name: "SuperAdmin",
        role: "SUPER_ADMIN",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000008",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Nexora demo & quickfill alias accounts
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c005"),
        email: "admin@nexora.com",
        first_name: "Zevo",
        last_name: "Admin",
        role: "ADMIN",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000010",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c006"),
        email: "seller@nexora.com",
        first_name: "David",
        last_name: "Merchant",
        role: "SELLER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000011",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c007"),
        email: "customer@nexora.com",
        first_name: "Alex",
        last_name: "Customer",
        role: "CUSTOMER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000012",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c009"),
        email: "superadmin@nexora.com",
        first_name: "Executive",
        last_name: "SuperAdmin",
        role: "SUPER_ADMIN",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000009",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c010"),
        email: "buyer@nexora.com",
        first_name: "Sarah",
        last_name: "Buyer",
        role: "CUSTOMER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000013",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c011"),
        email: "vendor@nexora.com",
        first_name: "Elena",
        last_name: "Vendor",
        role: "SELLER",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000014",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c012"),
        email: "rider@nexora.com",
        first_name: "Marco",
        last_name: "Rider",
        role: "DELIVERY_AGENT",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000015",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c013"),
        email: "courier@nexora.com",
        first_name: "Liam",
        last_name: "Courier",
        role: "DELIVERY_AGENT",
        password_hash: DEFAULT_PASSWORD_HASH,
        phone: "+15550000016",
        avatar_url: null,
        is_email_verified: true,
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const u of defaultUsers) {
      await usersCol.updateOne(
        { email: u.email.toLowerCase().trim() },
        { $setOnInsert: u },
        { upsert: true }
      );
    }
    logger.info(`Verified ${defaultUsers.length} initial accounts in MongoDB.`);

    
    // 3. Check & Seed Delivery Agents with Zones
    const deliveryAgentsCol = db.collection("delivery_agents");
    const riderUsers = await usersCol.find({ role: "DELIVERY_AGENT" }).toArray();
    for (const ru of riderUsers) {
      const existingAgent = await deliveryAgentsCol.findOne({ user_id: ru._id });
      if (!existingAgent) {
        await deliveryAgentsCol.insertOne({
          user_id: ru._id,
          vehicle_type: "motorcycle",
          vehicle_number: "DHAKA-METRO-HA-" + Math.floor(1000 + Math.random() * 9000),
          license_number: "LIC-BD-" + Math.floor(100000 + Math.random() * 900000),
          status: "approved",
          is_online: true,
          current_location: {
            type: "Point",
            coordinates: [90.4125, 23.8103],
          },
          active_task_id: null,
          pending_earnings: 12000,
          total_earnings: 85000,
          rating: 4.9,
          total_deliveries: 42,
          delivery_zones: ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi", "Mirpur"],
          service_city: "Dhaka",
          created_at: new Date(),
          updated_at: new Date(),
        });
      } else if (!existingAgent.delivery_zones || existingAgent.delivery_zones.length === 0) {
        await deliveryAgentsCol.updateOne(
          { _id: existingAgent._id },
          {
            $set: {
              delivery_zones: ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi", "Mirpur"],
              service_city: "Dhaka",
              is_online: true,
              status: "approved",
              updated_at: new Date(),
            },
          }
        );
      }
    }

    // 2. Check & Seed Sellers
    const sellersCol = db.collection("sellers");
    const defaultSellers = [
      {
        _id: new ObjectId("65f1a1b1c1d1e1f1a1b1c002"),
        user_id: new ObjectId("65f1a2b3c4d5e6f7a8b9c002"),
        stripe_account_id: "acct_demo_zevo_merchant",
        stripe_onboarding_complete: true,
        status: "approved",
        business_name: "Zevo Artisan Markets LLC",
        business_type: "company",
        tax_id: "XX-XXXXXXX",
        bank_verified: true,
        total_earnings: 1254000,
        total_commission_paid: 125400,
        pending_balance: 45000,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("65f1a1b1c1d1e1f1a1b1c003"),
        user_id: new ObjectId("65f1a2b3c4d5e6f7a8b9c006"),
        stripe_account_id: "acct_demo_nexora_merchant",
        stripe_onboarding_complete: true,
        status: "approved",
        business_name: "Nexora Prime Merchants",
        business_type: "company",
        tax_id: "XX-XXXXXXX",
        bank_verified: true,
        total_earnings: 890000,
        total_commission_paid: 89000,
        pending_balance: 32000,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const s of defaultSellers) {
      await sellersCol.updateOne(
        { _id: s._id },
        { $setOnInsert: s },
        { upsert: true }
      );
    }
    logger.info(`Verified ${defaultSellers.length} seller profiles in MongoDB.`);

    // 3. Check & Seed Flagship Store
    const storeId = new ObjectId("65f1a1b1c1d1e1f1a1b1c001");
    const sellerId = new ObjectId("65f1a1b1c1d1e1f1a1b1c002");
    await storesCol.updateOne(
      { slug: "zevo-flagship-market" },
      {
        $setOnInsert: {
          _id: storeId,
          seller_id: sellerId,
          name: "Zevo Flagship Market",
          slug: "zevo-flagship-market",
          description: "Official Zevo flagship marketplace for fresh artisan groceries, organic produce, and premium lifestyle goods.",
          logo_url: "/images/branding/zevo-icon.png",
          banner_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop",
          is_active: true,
          is_verified: true,
          rating_avg: 4.96,
          rating_count: 248,
          commission_rate: 0.1,
          address: {
            street: "100 Artisan Way",
            city: "San Francisco",
            state: "CA",
            postal_code: "94107",
            country: "USA",
          },
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
    logger.info("Verified Zevo Flagship Store in MongoDB.");

    // 3. Check & Seed Categories
    const categoryCount = await categoriesCol.countDocuments();
    const catMap: Record<string, ObjectId> = {};

    const initialCategories = [
      {
        _id: new ObjectId("66f000000000000000000001"),
        name: "Drinks",
        slug: "drinks",
        image_url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("66f000000000000000000002"),
        name: "Eco Garden",
        slug: "eco-garden",
        image_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("66f000000000000000000003"),
        name: "Fresh Nuts",
        slug: "fresh-nuts",
        image_url: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("66f000000000000000000004"),
        name: "Fruits",
        slug: "fruits",
        image_url: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 4,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("66f000000000000000000005"),
        name: "Spices",
        slug: "spices",
        image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 5,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: new ObjectId("66f000000000000000000006"),
        name: "Meat & Seafood",
        slug: "meat-seafood",
        image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=600&auto=format&fit=crop",
        is_active: true,
        sort_order: 6,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    if (categoryCount === 0) {
      logger.info("Initializing shop categories directly into MongoDB...");
      await categoriesCol.insertMany(initialCategories);
      initialCategories.forEach((c) => (catMap[c.slug] = c._id));
      logger.info(`Seeded ${initialCategories.length} categories into MongoDB.`);
    } else {
      // Ensure existing categories have image_url updated if missing
      for (const cat of initialCategories) {
        await categoriesCol.updateOne(
          { slug: cat.slug },
          { $set: { image_url: cat.image_url, name: cat.name, is_active: true } }
        );
      }
      const existing = await categoriesCol.find().toArray();
      existing.forEach((c) => (catMap[c.slug] = c._id));
    }

    // 4. Check & Seed Products
    const productCount = await productsCol.countDocuments();
    if (productCount === 0) {
      logger.info("Initializing full catalog products directly into MongoDB...");

      const catDrinks = catMap["drinks"] || new ObjectId("66f000000000000000000001");
      const catEcoGarden = catMap["eco-garden"] || new ObjectId("66f000000000000000000002");
      const catFreshNuts = catMap["fresh-nuts"] || new ObjectId("66f000000000000000000003");
      const catFruits = catMap["fruits"] || new ObjectId("66f000000000000000000004");
      const catSpices = catMap["spices"] || new ObjectId("66f000000000000000000005");
      const catMeat = catMap["meat-seafood"] || new ObjectId("66f000000000000000000006");

      const rawProducts = [
        {
          name: "Banana Flavor Fruit",
          slug: "banana-flavor-fruit",
          category_id: catFruits,
          base_price: 9000,
          compare_at_price: null,
          inventory_quantity: 0,
          images: [
            "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=900&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Naturally sweet golden organic bananas harvested at peak ripeness. Packed with potassium and wholesome energy.",
          tags: ["fruits", "yellow", "1kg", "brand-1", "organic", "vegan", "hot"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "1kg" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "Berry Smoothie Concor",
          slug: "berry-smoothie-concor",
          category_id: catDrinks,
          base_price: 35000,
          compare_at_price: null,
          inventory_quantity: 45,
          images: [
            "https://images.unsplash.com/photo-1537640538966-79f369143f8f?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Rich blended green grapes and wild berry smoothie concentrate. Pure cold-pressed richness without added refined sugars.",
          tags: ["drinks", "green", "500g", "brand-2", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 2" }],
        },
        {
          name: "Cabbage Fresh",
          slug: "cabbage-fresh",
          category_id: catEcoGarden,
          base_price: 5000,
          compare_at_price: 8000,
          inventory_quantity: 120,
          images: [
            "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Crisp and succulent farm fresh green cabbage head grown in certified organic soil.",
          tags: ["eco-garden", "green", "1kg", "brand-3", "organic", "vegan", "hot", "deal"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "1kg" }, { name: "Brand", value: "Brand 3" }],
        },
        {
          name: "Cherry Juice",
          slug: "cherry-juice",
          category_id: catDrinks,
          base_price: 12000,
          compare_at_price: null,
          inventory_quantity: 35,
          images: [
            "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Freshly sliced Asian crisp pear and cold-pressed tart cherry essence. Rich in natural antioxidants.",
          tags: ["drinks", "green", "250g", "brand-1", "organic", "vegan", "hot"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "250g" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "Coconut Juice",
          slug: "coconut-juice",
          category_id: catDrinks,
          base_price: 20000,
          compare_at_price: null,
          inventory_quantity: 60,
          images: [
            "https://images.unsplash.com/photo-1544378730-8b5104b18790?q=80&w=900&auto=format&fit=crop",
          ],
          description: "100% pure tender green coconut water straight from coastal groves.",
          tags: ["drinks", "green", "500g", "brand-4", "organic", "vegan", "hot"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "Consectetuer Adipi",
          slug: "consectetuer-adipi",
          category_id: catFruits,
          base_price: 1500,
          compare_at_price: 7900,
          inventory_quantity: 0,
          images: [
            "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Creamy Hass avocado harvested at prime oil richness for maximum nutrition.",
          tags: ["fruits", "green", "200g", "brand-2", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 2" }],
        },
        {
          name: "Eggs",
          slug: "farm-fresh-eggs",
          category_id: catEcoGarden,
          base_price: 7900,
          compare_at_price: 9900,
          inventory_quantity: 80,
          images: [
            "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Free-range pasture raised farm fresh brown eggs with rich golden yolks.",
          tags: ["eco-garden", "yellow", "500g", "brand-3", "organic", "hot", "deal"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 3" }],
        },
        {
          name: "Farm Vegetables",
          slug: "farm-vegetables-basket",
          category_id: catEcoGarden,
          base_price: 15000,
          compare_at_price: null,
          inventory_quantity: 50,
          images: [
            "https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Heirloom crate of organic vine tomatoes, white radishes, and root carrots.",
          tags: ["eco-garden", "red", "1kg", "brand-4", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Red" }, { name: "Weight", value: "1kg" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "Fresh Beef Meat",
          slug: "fresh-beef-meat",
          category_id: catMeat,
          base_price: 10000,
          compare_at_price: null,
          inventory_quantity: 0,
          images: [
            "https://images.unsplash.com/photo-1603048588665-791ca8aea617?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Premium grass-fed lean beef cuts garnished with fresh rosemary.",
          tags: ["meat-seafood", "red", "500g", "brand-1", "meat", "hot"],
          attributes: [{ name: "Color", value: "Red" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "Fresh Seafood",
          slug: "fresh-seafood-salmon",
          category_id: catMeat,
          base_price: 2500,
          compare_at_price: 9000,
          inventory_quantity: 40,
          images: [
            "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Delicate thinly sliced cold-smoked Atlantic salmon with fresh dill and lemon.",
          tags: ["meat-seafood", "pink", "200g", "brand-2", "meat"],
          attributes: [{ name: "Color", value: "Pink" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 2" }],
        },
        {
          name: "Kale Bunch",
          slug: "kale-bunch-watermelon",
          category_id: catFruits,
          base_price: 15000,
          compare_at_price: null,
          inventory_quantity: 90,
          images: [
            "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Crisp organic seedless watermelon slice and farm-fresh heirloom greens.",
          tags: ["fruits", "green", "1kg", "brand-3", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Green" }, { name: "Weight", value: "1kg" }, { name: "Brand", value: "Brand 3" }],
        },
        {
          name: "Orange Juice",
          slug: "orange-juice-smoothie",
          category_id: catDrinks,
          base_price: 5000,
          compare_at_price: 7900,
          inventory_quantity: 75,
          images: [
            "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Creamy probiotic strawberry yogurt shake with real berries and Valencia orange.",
          tags: ["drinks", "pink", "250g", "brand-4", "organic", "hot", "deal"],
          attributes: [{ name: "Color", value: "Pink" }, { name: "Weight", value: "250g" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "Organic Potato",
          slug: "organic-potato",
          category_id: catEcoGarden,
          base_price: 10000,
          compare_at_price: 15000,
          inventory_quantity: 110,
          images: [
            "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Unwashed earthen russet potatoes packed with natural earthy aroma.",
          tags: ["eco-garden", "yellow", "1kg", "brand-1", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "1kg" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "California Raw Almonds",
          slug: "california-raw-almonds",
          category_id: catFreshNuts,
          base_price: 4500,
          compare_at_price: null,
          inventory_quantity: 70,
          images: [
            "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Unpasteurized nonpareil California almonds. Crunchy, nutrient-dense, and loaded with vitamin E.",
          tags: ["fresh-nuts", "yellow", "250g", "brand-3", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "250g" }, { name: "Brand", value: "Brand 3" }],
        },
        {
          name: "Organic Cashew Nuts",
          slug: "organic-cashew-nuts",
          category_id: catFreshNuts,
          base_price: 6500,
          compare_at_price: null,
          inventory_quantity: 50,
          images: [
            "https://images.unsplash.com/photo-1536591375315-1b8ea8941916?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Whole W320 jumbo raw cashews. Naturally creamy and sweet, perfect for snacking.",
          tags: ["fresh-nuts", "yellow", "200g", "brand-4", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "English Walnuts Shelled",
          slug: "english-walnuts-shelled",
          category_id: catFreshNuts,
          base_price: 8500,
          compare_at_price: null,
          inventory_quantity: 40,
          images: [
            "https://images.unsplash.com/photo-1585849834908-3481231155e8?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Light amber walnut halves packed with brain-boosting ALA Omega-3 fatty acids.",
          tags: ["fresh-nuts", "yellow", "500g", "brand-1", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "Organic Ceylon Cinnamon",
          slug: "organic-ceylon-cinnamon",
          category_id: catSpices,
          base_price: 2500,
          compare_at_price: null,
          inventory_quantity: 90,
          images: [
            "https://images.unsplash.com/photo-1509358271058-acd22cc93898?q=80&w=900&auto=format&fit=crop",
          ],
          description: "True Ceylon cinnamon quills directly from family estates. Fragrant, delicate, and pure.",
          tags: ["spices", "red", "200g", "brand-2", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Red" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 2" }],
        },
        {
          name: "Tellicherry Black Peppercorns",
          slug: "tellicherry-black-peppercorns",
          category_id: catSpices,
          base_price: 1800,
          compare_at_price: null,
          inventory_quantity: 80,
          images: [
            "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Extra bold aromatic black peppercorns from Malabar coast with warm cedar notes.",
          tags: ["spices", "black", "200g", "brand-3", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Black" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 3" }],
        },
        {
          name: "Alleppey Turmeric Powder",
          slug: "alleppey-turmeric-powder",
          category_id: catSpices,
          base_price: 2200,
          compare_at_price: null,
          inventory_quantity: 110,
          images: [
            "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Vibrant golden root powder with over 5% natural curcumin content.",
          tags: ["spices", "yellow", "250g", "brand-4", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Yellow" }, { name: "Weight", value: "250g" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "Organic Red Chili Flakes",
          slug: "organic-red-chili-flakes",
          category_id: catSpices,
          base_price: 1600,
          compare_at_price: null,
          inventory_quantity: 75,
          images: [
            "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Sun-dried crushed red pepper flakes with seeds. Delivers warm tingling heat.",
          tags: ["spices", "red", "200g", "brand-1", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Red" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 1" }],
        },
        {
          name: "Fresh Blueberries Punnet",
          slug: "fresh-blueberries-punnet",
          category_id: catFruits,
          base_price: 3500,
          compare_at_price: null,
          inventory_quantity: 65,
          images: [
            "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Plump organic highbush blueberries bursting with sweet-tart antioxidant bliss.",
          tags: ["fruits", "blue", "250g", "brand-2", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Blue" }, { name: "Weight", value: "250g" }, { name: "Brand", value: "Brand 2" }],
        },
        {
          name: "Wild Organic Blackberries",
          slug: "wild-organic-blackberries",
          category_id: catFruits,
          base_price: 4200,
          compare_at_price: null,
          inventory_quantity: 40,
          images: [
            "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Dark juicy bramble blackberries hand-picked in the morning dew.",
          tags: ["fruits", "black", "200g", "brand-4", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Black" }, { name: "Weight", value: "200g" }, { name: "Brand", value: "Brand 4" }],
        },
        {
          name: "Pink Pitaya Dragonfruit",
          slug: "pink-pitaya-dragonfruit",
          category_id: catFruits,
          base_price: 5500,
          compare_at_price: null,
          inventory_quantity: 35,
          images: [
            "https://images.unsplash.com/photo-1527325678964-54921661f888?q=80&w=900&auto=format&fit=crop",
          ],
          description: "Exotic magenta dragonfruit with tender green scales and sweet seed-speckled pulp.",
          tags: ["fruits", "pink", "500g", "brand-3", "organic", "vegan"],
          attributes: [{ name: "Color", value: "Pink" }, { name: "Weight", value: "500g" }, { name: "Brand", value: "Brand 3" }],
        },
      ];

      const docs = rawProducts.map((p, idx) => ({
        _id: new ObjectId(),
        store_id: storeId,
        seller_id: sellerId,
        category_id: p.category_id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: "approved" as const,
        images: p.images,
        tags: p.tags,
        attributes: p.attributes,
        variants: [
          {
            _id: new ObjectId(),
            sku: `${p.slug.toUpperCase().slice(0, 8)}-STD`,
            name: "Standard Pack",
            attributes: {},
            price: p.base_price,
            compare_at_price: p.compare_at_price || undefined,
            weight_grams: 500,
            is_active: true,
          },
        ],
        base_price: p.base_price,
        compare_at_price: p.compare_at_price,
        inventory_quantity: p.inventory_quantity,
        rating_avg: idx % 3 === 0 ? 5.0 : idx % 3 === 1 ? 4.8 : 4.9,
        rating_count: 25 + idx * 6,
        total_sold: 70 + idx * 12,
        is_deleted: false,
        created_at: new Date(Date.now() - idx * 86400000),
        updated_at: new Date(),
      }));

      await productsCol.insertMany(docs);
      logger.info(`Seeded ${docs.length} catalog products into MongoDB.`);
    } else {
      logger.info(`Products collection already contains ${productCount} items, skipping seed.`);
    }

    // 5. Ensure all catalog products and variants have active inventory documents
    const inventoryCol = db.collection("inventory");
    const activeProducts = await productsCol.find({ is_deleted: false }).toArray();
    let syncedInv = 0;
    for (const prod of activeProducts) {
      for (const variant of prod.variants || []) {
        const invExists = await inventoryCol.findOne({ variant_id: variant._id });
        if (!invExists) {
          const initialStock = Math.max(
            50,
            prod.inventory_quantity !== undefined && prod.inventory_quantity !== null
              ? prod.inventory_quantity
              : 50
          );
          await inventoryCol.insertOne({
            product_id: prod._id,
            variant_id: variant._id,
            sku: variant.sku || `${prod.slug}-std`,
            store_id: prod.store_id,
            seller_id: prod.seller_id,
            quantity_available: initialStock,
            quantity_reserved: 0,
            low_stock_threshold: 10,
            is_trackable: true,
            created_at: new Date(),
            updated_at: new Date(),
          });
          syncedInv++;
        }
      }
    }
    if (syncedInv > 0) {
      logger.info(`Provisioned inventory documents for ${syncedInv} product variants in MongoDB.`);
    }

    // 6. Ensure all products have clean, readable name-based slugs
    for (const prod of activeProducts) {
      if (!prod.slug || prod.slug.includes("-mtzhv984") || /-[a-z0-9]{8}$/.test(prod.slug)) {
        const cleanBase = (prod.name || "")
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (cleanBase) {
          const conflict = await productsCol.findOne({ _id: { $ne: prod._id }, slug: cleanBase, is_deleted: false });
          const targetSlug = conflict ? `${cleanBase}-${prod._id.toString().slice(-4)}` : cleanBase;
          await productsCol.updateOne({ _id: prod._id }, { $set: { slug: targetSlug } });
          logger.info(`Normalized product slug for "${prod.name}" -> "${targetSlug}"`);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error during database bootstrap verification");
  }
}
