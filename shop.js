/* =============================================================
   GYMORA — supplements shop (16+ only)
   Demo store: browse supplements, add to cart, checkout (toast).
   Real payments arrive with the backend phase.
   Relies on globals: state, t, I18N, currentUser, reRenderSection,
   toast, esc, fmtPrice.
   ============================================================= */

const SHOP_I18N = {
  en: {
    suppShop: "Supplements",
    shopSub: "Stock up on your stack — delivered or picked up at your gym.",
    ageBlock: "The supplements shop is for members aged 16+.",
    addCart: "Add to cart", inCartN: "{n} in cart",
    cartTitle: "Cart", cartEmpty: "Your cart is empty.",
    total: "Total", checkout: "Checkout",
    orderPlaced: "Order placed! Pick it up at your gym's counter 📦 (demo)",
    perUnit: "each",
  },
  ar: {
    suppShop: "المكملات",
    shopSub: "جهّز مكملاتك — توصيل أو استلام من ناديك.",
    ageBlock: "متجر المكملات للأعضاء بعمر 16+.",
    addCart: "أضف للسلة", inCartN: "{n} في السلة",
    cartTitle: "السلة", cartEmpty: "سلتك فارغة.",
    total: "المجموع", checkout: "إتمام الشراء",
    orderPlaced: "تم الطلب! استلمه من كاونتر ناديك 📦 (تجريبي)",
    perUnit: "للقطعة",
  },
};
Object.assign(I18N.en, SHOP_I18N.en);
Object.assign(I18N.ar, SHOP_I18N.ar);

/* prices in JOD (converted by fmtPrice) */
const SUPP_ITEMS = [
  { key: "whey", emoji: "🥤", priceJOD: 35, name: { en: "Whey protein 2kg", ar: "واي بروتين 2كغ" } },
  { key: "creatine", emoji: "⚡", priceJOD: 20, name: { en: "Creatine monohydrate", ar: "كرياتين مونوهيدرات" } },
  { key: "preworkout", emoji: "🔥", priceJOD: 25, name: { en: "Pre-workout", ar: "بري وورك آوت" } },
  { key: "bcaa", emoji: "🧪", priceJOD: 18, name: { en: "BCAA / EAA", ar: "أحماض أمينية BCAA" } },
  { key: "bar", emoji: "🍫", priceJOD: 2.5, name: { en: "Protein bar", ar: "لوح بروتين" } },
  { key: "multivit", emoji: "💊", priceJOD: 15, name: { en: "Multivitamin", ar: "فيتامينات متعددة" } },
  { key: "omega", emoji: "🐟", priceJOD: 12, name: { en: "Omega-3", ar: "أوميغا 3" } },
  { key: "shaker", emoji: "🧋", priceJOD: 8, name: { en: "GYMORA shaker", ar: "شيكر GYMORA" } },
];

/* session cart: key -> qty (not persisted in the demo) */
let shopCart = {};

function secSupps(u) {
  if ((u.age || 0) < 16) {
    return `
    <h3>💊 ${t("suppShop")}</h3>
    <div class="h-sub">${t("shopSub")}</div>
    <div class="section" style="text-align:center;padding:34px 12px">
      <div style="font-size:40px">🔞</div>
      <p style="font-weight:700;margin-top:10px">${t("ageBlock")}</p>
    </div>`;
  }
  const entries = Object.entries(shopCart).filter(([, q]) => q > 0);
  const totalJOD = entries.reduce((a, [k, q]) => a + SUPP_ITEMS.find(x => x.key === k).priceJOD * q, 0);
  const cart = entries.length ? `
    <div class="section">
      <h4>🛒 ${t("cartTitle")}</h4>
      ${entries.map(([k, q]) => {
        const it = SUPP_ITEMS.find(x => x.key === k);
        return `<div class="kv"><span>${it.emoji} ${it.name[state.lang]} × ${q}</span>
          <span><b>${fmtPrice(it.priceJOD * q)}</b> <button class="auth-link fr-del" data-remsupp="${k}">✕</button></span></div>`;
      }).join("")}
      <div class="kv" style="border-bottom:none"><span><b>${t("total")}</b></span><span><b>${fmtPrice(totalJOD)}</b></span></div>
      <button class="btn block" id="suppCheckout">💳 ${t("checkout")} — ${fmtPrice(totalJOD)}</button>
    </div>` : `<div class="note">${t("cartEmpty")}</div>`;
  return `
  <h3>💊 ${t("suppShop")}</h3>
  <div class="h-sub">${t("shopSub")}</div>
  <div class="reward-grid">
    ${SUPP_ITEMS.map(it => `
      <div class="reward-card">
        <div class="rw-ico">${it.emoji}</div>
        <div class="rw-name">${it.name[state.lang]}</div>
        <div class="rw-cost">${fmtPrice(it.priceJOD)} <small style="color:var(--muted)">${t("perUnit")}</small></div>
        <button class="btn" data-addsupp="${it.key}">${shopCart[it.key] ? t("inCartN").replace("{n}", shopCart[it.key]) : t("addCart")}</button>
      </div>`).join("")}
  </div>
  ${cart}`;
}

function handleShopClick(e) {
  const hit = (s) => e.target.closest(s);
  const add = hit("[data-addsupp]");
  if (add) { const k = add.dataset.addsupp; shopCart[k] = (shopCart[k] || 0) + 1; reRenderSection(); return true; }
  const rem = hit("[data-remsupp]");
  if (rem) { delete shopCart[rem.dataset.remsupp]; reRenderSection(); return true; }
  if (hit("#suppCheckout")) { shopCart = {}; reRenderSection(); toast(t("orderPlaced")); return true; }
  return false;
}
