/**
 * Battlepie Store & Server Data Model
 * Extracted & Reverse-Engineered from battlepie.net
 */

const BATTLEPIE_DATA = {
  server: {
    ip: "Node1.mineorange.fun:25569",
    port: 25569,
    bedrockPort: 19132,
    defaultPlayersOnline: 319,
    defaultDiscordOnline: 2583,
    discordInvite: "https://discord.gg/battlepie",
    version: "BattlePie 1.8-1.21+",
    motd: "BATTLEPIE | [1.21+] LIFESTEAL NEW SEASON OUT!"
  },
  goal: {
    title: "Monthly Goal",
    current: 107.47,
    target: 2000.00,
    percentage: 5.37
  },
  topDonor: {
    username: "RISHU69Sucks",
    amount: 717.20,
    skinUrl: "https://battlepie.net/skin/body/RISHU69Sucks?s=200",
    fallbackSkinUrl: "https://mc-heads.net/body/RISHU69Sucks/200"
  },
  recentPayments: [
    { username: "_MrFrosty", amount: 3.60 },
    { username: "HARSHGAMER0511", amount: 4.00 },
    { username: "HARSHGAMER0511", amount: 10.00 },
    { username: "Frost_xexx", amount: 0.90 },
    { username: "Aryan_Demonn", amount: 1.80 },
    { username: "Anshu_legend", amount: 0.90 },
    { username: "spidey_sensedyou", amount: 3.60 },
    { username: "T0Tem_02", amount: 0.90 },
    { username: "_MrFrosty", amount: 3.60 },
    { username: "_MrFrosty", amount: 3.24 }
  ],
  categories: [
    {
      id: "all",
      name: "Featured Products",
      slug: "featured",
      bannerImage: "https://battlepie.net/uploads/store/p-1783259788827-8daud7.png"
    },
    {
      id: "ranks",
      name: "Ranks",
      slug: "ranks",
      bannerImage: "https://battlepie.net/uploads/store/p-1783259831161-dgia1y.png"
    },
    {
      id: "lifesteal",
      name: "Lifesteal Coins",
      slug: "lifesteal",
      bannerImage: "https://battlepie.net/uploads/store/p-1783259846498-og458w.png"
    }
  ],
  products: [
    {
      id: 3,
      slug: "pie",
      categoryId: "ranks",
      name: "Pie [Monthly]",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260149842-isfgnh.png",
      shortDescription: "Pie rank monthly",
      description: "- 10 Auction Slots\n- 15 Vaults\n- 25 Homes\n- 100 Coinflips limit\n- /anvil\n- /ec\n- /workbench (/craft)\n- /loom\n- /grindstone\n- PIE Kit\n- Queue Bypass\n- Lower RTP cooldown (60s)\n- 5 Shard per kill",
      priceUsdCents: 500,
      originalPriceUsdCents: 500,
      isSubscription: true,
      billingPeriodDays: 30,
      featured: true
    },
    {
      id: 4,
      slug: "pie-plus",
      categoryId: "ranks",
      name: "Pie+ [Monthly]",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260162789-y9dq85.png",
      shortDescription: "Pie+ rank monthly",
      description: "- 12 Auction Slots\n- 25 Vaults\n- 50 Homes\n- 100 Coinflips limit\n- /anvil\n- /ec\n- /workbench (/craft)\n- /loom\n- /grindstone\n- /ptime\n- /kittycannon\n- PIE Kit\n- PIE Plus Kit\n- Queue Bypass\n- Lower RTP cooldown (30s)\n- Get 1 shards per minute anywhere in Lifesteal gamemode\n- Get 10 shards per kill",
      priceUsdCents: 1500,
      originalPriceUsdCents: 1500,
      isSubscription: true,
      billingPeriodDays: 30,
      featured: true
    },
    {
      id: 5,
      slug: "pie-plus-plus",
      categoryId: "ranks",
      name: "Pie++ [Monthly]",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260178796-vp8tpi.png",
      shortDescription: "Pie++ rank monthly",
      description: "- 15 Auction Slots\n- 50 Vaults\n- 100 Homes\n- 100 Coinflips limit\n- PIE PlusPlus Kit\n- PIE Plus Kit\n- PIE Kit\n- Muffin Kit\n- Cupcake Kit\n- /anvil\n- /ec\n- /workbench (/craft)\n- /loom\n- /grindstone\n- /ptime\n- /kittycannon\n- /beezooka\n- Queue Bypass\n- Bypass RTP cooldown\n- Get 5 shards per minute anywhere in Lifesteal gamemode\n- Get 20 shards per kill",
      priceUsdCents: 2500,
      originalPriceUsdCents: 2500,
      isSubscription: true,
      billingPeriodDays: 30,
      featured: true
    },
    {
      id: 9,
      slug: "2k-coins",
      categoryId: "lifesteal",
      name: "2000 Coins",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260227305-9rbf5t.png",
      shortDescription: "2000 Coins in Lifesteal gamemode",
      description: "Instantly delivers 2,000 Coins directly to your in-game balance in Lifesteal gamemode. Use to trade, buy kits, or upgrade gear.",
      priceUsdCents: 400,
      originalPriceUsdCents: 400,
      isSubscription: false,
      billingPeriodDays: null,
      featured: true
    },
    {
      id: 10,
      slug: "5k-coins",
      categoryId: "lifesteal",
      name: "5000 Coins",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260227305-9rbf5t.png",
      shortDescription: "5000 Coins in Lifesteal gamemode",
      description: "Instantly delivers 5,000 Coins directly to your in-game balance in Lifesteal gamemode.",
      priceUsdCents: 1000,
      originalPriceUsdCents: 1000,
      isSubscription: false,
      billingPeriodDays: null,
      featured: true
    },
    {
      id: 6,
      slug: "10k-coins",
      categoryId: "lifesteal",
      name: "10,000 Coins",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260215619-80goup.png",
      shortDescription: "10,000 Coins in Lifesteal gamemode",
      description: "Instantly delivers 10,000 Coins directly to your in-game balance in Lifesteal gamemode.",
      priceUsdCents: 2000,
      originalPriceUsdCents: 2000,
      isSubscription: false,
      billingPeriodDays: null,
      featured: true
    },
    {
      id: 11,
      slug: "20k-coins",
      categoryId: "lifesteal",
      name: "20,000 Coins",
      imageUrl: "https://battlepie.net/uploads/store/p-1783260203546-cpk825.png",
      shortDescription: "20,000 Coins in Lifesteal gamemode",
      description: "Instantly delivers 20,000 Coins directly to your in-game balance in Lifesteal gamemode.",
      priceUsdCents: 4000,
      originalPriceUsdCents: 4000,
      isSubscription: false,
      billingPeriodDays: null,
      featured: true
    }
  ]
};

if (typeof window !== 'undefined') {
  window.BATTLEPIE_DATA = BATTLEPIE_DATA;
}
