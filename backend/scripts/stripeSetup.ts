import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getStripe, stripeConfigured } from "../src/services/stripe";

const PRODUCT_NAME = "Tribr Subscriber";
const AMOUNT_PENCE = 499;
const CURRENCY = "gbp";

async function main() {
  if (!stripeConfigured()) {
    console.error("STRIPE_SECRET_KEY is not set in backend/.env - add your Stripe test-mode secret key first.");
    process.exit(1);
  }
  const stripe = getStripe();

  const products = await stripe.products.search({ query: `name:'${PRODUCT_NAME}'` });
  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({ name: PRODUCT_NAME });
    console.log(`Created product ${product.id}`);
  } else {
    console.log(`Found existing product ${product.id}`);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true });
  let price = prices.data.find((p) => p.unit_amount === AMOUNT_PENCE && p.currency === CURRENCY && p.recurring?.interval === "month");
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: AMOUNT_PENCE,
      currency: CURRENCY,
      recurring: { interval: "month" },
    });
    console.log(`Created price ${price.id} (£${(AMOUNT_PENCE / 100).toFixed(2)}/month)`);
  } else {
    console.log(`Found existing matching price ${price.id}`);
  }

  const envPath = path.join(__dirname, "..", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const updated = envContent.includes("STRIPE_PRICE_ID=")
    ? envContent.replace(/STRIPE_PRICE_ID=".*"/, `STRIPE_PRICE_ID="${price.id}"`)
    : `${envContent}\nSTRIPE_PRICE_ID="${price.id}"\n`;
  fs.writeFileSync(envPath, updated);
  console.log(`Wrote STRIPE_PRICE_ID=${price.id} to backend/.env`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
