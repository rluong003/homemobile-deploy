"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeApi = void 0;
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(`${process.env.STRIPE_KEY}`, {
    apiVersion: "2020-03-02",
});
exports.StripeApi = {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    connect: (code) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield stripe.oauth.token({
            grant_type: "authorization_code",
            code,
        });
        return res;
    }),
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    charge: (amount, source, stripeAccount) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield stripe.charges.create({
            amount: amount,
            currency: 'usd',
            source: source,
            application_fee_amount: Math.round(amount * 0.05),
        }, { stripeAccount: stripeAccount });
        if (res.status !== 'succeeded') {
            throw new Error("Stripe charge failed");
        }
    })
};
