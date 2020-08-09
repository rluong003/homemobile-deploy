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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Google = void 0;
const googleapis_1 = require("googleapis");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.PUBLIC_URL}/login`);
const maps = new google_maps_services_js_1.Client({});
const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];
const addressParser = (addressComponents) => {
    let country = null;
    let city = null;
    let adminArea = null;
    for (const components of addressComponents) {
        for (const type of components.types) {
            if (type === "country") {
                country = components.long_name;
            }
            if (type === "administrative_area_level_1") {
                adminArea = components.long_name;
            }
            if (type === "locality" || type === "postal_town") {
                city = components.long_name;
            }
        }
    }
    return { country, city, adminArea };
};
exports.Google = {
    authUrl: oauth2Client.generateAuthUrl({
        scope: scopes,
    }),
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    logIn: (code) => __awaiter(void 0, void 0, void 0, function* () {
        const { tokens } = yield oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const { data } = yield googleapis_1.google
            .people({ version: "v1", auth: oauth2Client })
            .people.get({
            resourceName: "people/me",
            personFields: "emailAddresses,names,photos",
        });
        return { user: data };
    }),
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    geocode: (address) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield maps
            .geocode({
            params: { address: address, key: `${process.env.GEO_KEY}` },
            timeout: 1000,
        });
        if (res.status < 200 || res.status > 299) {
            throw new Error("failed to geocode address");
        }
        return addressParser(res.data.results[0].address_components);
    }),
};
