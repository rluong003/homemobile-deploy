"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.resolvers = void 0;
const _ = __importStar(require("lodash"));
const mongodb_1 = require("mongodb");
const types_1 = require("../lib/types");
const Google_1 = require("../lib/api/Google");
const Stripe_1 = require("../lib/api/Stripe");
const Cloudinary_1 = require("../lib/api/Cloudinary");
const index_1 = require("../index");
const crypto_1 = __importDefault(require("crypto"));
const cookieOptions = {
    httpOnly: true,
    sameSite: true,
    signed: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
};
const validInput = ({ title, description, price, type }) => {
    if (title.length > 35) {
        throw new Error("listing title must be under 35 characters");
    }
    if (description.length > 1000) {
        throw new Error("listing description must be under 1000 characters");
    }
    if (type !== types_1.ListingType.APARTMENT &&
        type !== types_1.ListingType.HOUSE &&
        type !== types_1.ListingType.ROOM) {
        throw new Error("Please choose a valid listing type (room, apartment, home)");
    }
    if (price < 0) {
        throw new Error("price must be greater than 0");
    }
};
const logInViaGoogle = (code, token, db, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { user } = yield Google_1.Google.logIn(code);
    if (!user) {
        throw new Error("Google login error");
    }
    // Names/Photos/Email Lists
    const userNamesList = user.names && user.names.length ? user.names : null;
    const userPhotosList = user.photos && user.photos.length ? user.photos : null;
    const userEmailsList = user.emailAddresses && user.emailAddresses.length
        ? user.emailAddresses
        : null;
    // User Display Name
    const userName = userNamesList ? userNamesList[0].displayName : null;
    // User Id
    const userId = userNamesList &&
        userNamesList[0].metadata &&
        userNamesList[0].metadata.source
        ? userNamesList[0].metadata.source.id
        : null;
    // User Avatar
    const userAvatar = userPhotosList && userPhotosList[0].url ? userPhotosList[0].url : null;
    // User Email
    const userEmail = userEmailsList && userEmailsList[0].value ? userEmailsList[0].value : null;
    if (!userId || !userName || !userAvatar || !userEmail) {
        throw new Error("Google login error");
    }
    const updateRes = yield db.users.findOneAndUpdate({ _id: userId }, {
        $set: {
            name: userName,
            pfp: userAvatar,
            email: userEmail,
            token,
        },
    }, { returnOriginal: false });
    let viewer = updateRes.value;
    if (!viewer) {
        const insertResult = yield db.users.insertOne({
            _id: userId,
            token,
            name: userName,
            pfp: userAvatar,
            email: userEmail,
            income: 0,
            bookings: [],
            listings: [],
        });
        viewer = insertResult.ops[0];
    }
    res.cookie("viewer", userId, Object.assign(Object.assign({}, cookieOptions), { maxAge: 365 * 24 * 60 * 60 * 1000 }));
    return viewer;
});
const logInViaCookie = (token, db, req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const updateRes = yield db.users.findOneAndUpdate({ _id: req.signedCookies.viewer }, { $set: { token } }, { returnOriginal: false });
    // eslint-disable-next-line prefer-const
    let viewer = updateRes.value;
    if (!viewer) {
        res.clearCookie("viewer", cookieOptions);
    }
    return viewer;
});
const resolveBookingsIndex = (bookingsIndex, checkInDate, checkOutDate) => {
    let dateCursor = new Date(checkInDate);
    // eslint-disable-next-line prefer-const
    let checkOut = new Date(checkOutDate);
    const newBookingsIndex = Object.assign({}, bookingsIndex);
    while (dateCursor <= checkOut) {
        const y = dateCursor.getUTCFullYear();
        const m = dateCursor.getUTCMonth();
        const d = dateCursor.getUTCDate();
        if (!newBookingsIndex[y]) {
            newBookingsIndex[y] = {};
        }
        if (!newBookingsIndex[y][m]) {
            newBookingsIndex[y][m] = {};
        }
        if (!newBookingsIndex[y][m][d]) {
            newBookingsIndex[y][m][d] = true;
        }
        else {
            throw new Error("Can't book dates that are already reserved");
        }
        dateCursor = new Date(dateCursor.getTime() + 86400000);
    }
    return newBookingsIndex;
};
const viewerResolvers = {
    Query: {
        authUrl: () => {
            try {
                return Google_1.Google.authUrl;
            }
            catch (error) {
                throw new Error(`Google auth query error: ${error}`);
            }
        },
    },
    Mutation: {
        logIn: (_root, { input }, { db, req, res }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const code = input ? input.code : null;
                const token = crypto_1.default.randomBytes(16).toString("hex");
                const viewer = code
                    ? yield logInViaGoogle(code, token, db, res)
                    : yield logInViaCookie(token, db, req, res);
                if (!viewer) {
                    return { didRequest: true };
                }
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.pfp,
                    walletId: viewer.walletId,
                    didRequest: true,
                };
            }
            catch (error) {
                throw new Error(`Log in Error ${error}`);
            }
        }),
        logOut: (_root, _args, { res }) => {
            try {
                res.clearCookie("viewer", cookieOptions);
                return { didRequest: true };
            }
            catch (error) {
                throw new Error(`Log out Error ${error}`);
            }
        },
        connectStripe: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { code } = input;
                let viewer = yield index_1.authorizeRequest(db, req);
                if (!viewer) {
                    throw new Error("Invalid Viewer");
                }
                const stripeRes = yield Stripe_1.StripeApi.connect(code);
                if (!stripeRes) {
                    throw new Error("Stripe connect error");
                }
                const allowWallet = yield db.users.findOneAndUpdate({ _id: viewer._id }, { $set: { walletId: stripeRes.stripe_user_id } }, { returnOriginal: false });
                if (!allowWallet.value) {
                    throw new Error("Viewer update error");
                }
                viewer = allowWallet.value;
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.pfp,
                    walletId: viewer.walletId,
                    didRequest: true,
                };
            }
            catch (error) {
                throw new Error(error);
            }
        }),
        disconnectStripe: (_root, _args, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                let viewer = yield index_1.authorizeRequest(db, req);
                if (!viewer) {
                    throw new Error("Invalid Viewer");
                }
                const disableWallet = yield db.users.findOneAndUpdate({ _id: viewer._id }, { $unset: { walletId: "" } }, { returnOriginal: false });
                if (!disableWallet.value) {
                    throw new Error("Stripe disconnect error");
                }
                viewer = disableWallet.value;
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.pfp,
                    walletId: viewer.walletId,
                    didRequest: true,
                };
            }
            catch (error) {
                throw new Error(error);
            }
        }),
    },
    Viewer: {
        id: (viewer) => {
            return viewer._id;
        },
        hasWallet: (viewer) => {
            return viewer.walletId ? true : undefined;
        },
    },
};
const userResolvers = {
    Query: {
        user: (_root, { id }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const user = yield db.users.findOne({ _id: id });
                if (!user) {
                    throw new Error("User doesn't exist");
                }
                const viewer = yield index_1.authorizeRequest(db, req);
                if (viewer && viewer._id === user._id) {
                    user.authorized = true;
                }
                return user;
            }
            catch (error) {
                throw new Error(`User query error: ${error}`);
            }
        }),
    },
    User: {
        id: (user) => {
            return user._id;
        },
        hasWallet: (user) => {
            return Boolean(user.walletId);
        },
        income: (user) => {
            return user.income;
        },
        bookings: (user, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const data = {
                    total: 0,
                    result: [],
                };
                let cursor = yield db.bookings.find({
                    _id: { $in: user.bookings },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = yield cursor.count();
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(` User bookings error: ${error}`);
            }
        }),
        listings: (user, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const data = {
                    total: 0,
                    result: [],
                };
                let cursor = yield db.listings.find({
                    _id: { $in: user.listings },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = yield cursor.count();
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`User listings error: ${error}`);
            }
        }),
    },
};
const listingResolvers = {
    Query: {
        listing: (_root, { id }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const listing = yield db.listings.findOne({ _id: new mongodb_1.ObjectID(id) });
                if (!listing) {
                    throw new Error("Listing can't be found");
                }
                const viewer = yield index_1.authorizeRequest(db, req);
                if (viewer && viewer._id === listing.host) {
                    listing.authorized = true;
                }
                return listing;
            }
            catch (error) {
                throw new Error(`Listing query error: ${error}`);
            }
        }),
        listings: (_root, { location, filter, limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const query = {};
                const data = {
                    region: null,
                    total: 0,
                    result: [],
                };
                if (location) {
                    const { country, city, adminArea } = yield Google_1.Google.geocode(location);
                    if (country)
                        query.country = country;
                    else {
                        throw new Error("Country couldn't be found.");
                    }
                    if (city)
                        query.city = city;
                    if (adminArea)
                        query.admin = adminArea;
                    const cityText = city ? `${city}, ` : "";
                    const adminText = adminArea ? `${adminArea}, ` : "";
                    data.region = `${cityText}${adminText}${country}`;
                }
                let cursor = db.listings.find(query);
                if (filter && filter === types_1.ListingsFilters.PRICE_HL) {
                    cursor = cursor.sort({ price: -1 });
                }
                if (filter && filter === types_1.ListingsFilters.PRICE_LH) {
                    cursor = cursor.sort({ price: 1 });
                }
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = yield cursor.count();
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`Listings query error: ${error}`);
            }
        }),
    },
    Mutation: {
        newListing: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            validInput(input);
            const viewer = yield index_1.authorizeRequest(db, req);
            if (!viewer) {
                throw new Error("Invalid viewer");
            }
            const { country, city, adminArea } = yield Google_1.Google.geocode(input.address);
            if (!country || !city || !adminArea) {
                throw new Error("Invalid address");
            }
            const imageURL = yield Cloudinary_1.Cloudinary.upload(input.image);
            const newlisting = yield db.listings.insertOne(Object.assign(Object.assign({ _id: new mongodb_1.ObjectID() }, input), { image: imageURL, bookings: [], bookingsIndex: {}, country, admin: adminArea, city, host: viewer._id }));
            const newinsertedListing = newlisting.ops[0];
            yield db.users.updateOne({ _id: viewer._id }, { $push: { listings: newinsertedListing._id } });
            return newinsertedListing;
        }),
    },
    Listing: {
        id: (listing) => {
            return listing._id.toString();
        },
        host: (listing, _args, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            const host = yield db.users.findOne({ _id: listing.host });
            if (!host) {
                throw new Error("Cant find user");
            }
            return host;
        }),
        bookingsIndex: (listing) => {
            return JSON.stringify(listing.bookingsIndex);
        },
        bookings: (listing, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const data = {
                    total: 0,
                    result: [],
                };
                if (!listing.authorized) {
                    return data;
                }
                let cursor = yield db.bookings.find({
                    _id: { $in: listing.bookings },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = yield cursor.count();
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`User bookings error: ${error}`);
            }
        }),
    },
};
const bookingResolvers = {
    Mutation: {
        bookListing: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, source, checkIn, checkOut } = input;
                const viewer = yield index_1.authorizeRequest(db, req);
                if (!viewer) {
                    throw new Error("invalid viewer");
                }
                const listing = yield db.listings.findOne({
                    _id: new mongodb_1.ObjectID(id),
                });
                if (!listing) {
                    throw new Error("invalid listing");
                }
                if (listing.host === viewer._id) {
                    throw new Error("viewer can't book own listing");
                }
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);
                if (checkOutDate < checkInDate) {
                    throw new Error("check out date can't be before check in date");
                }
                const bookingsIndex = resolveBookingsIndex(listing.bookingsIndex, checkIn, checkOut);
                const totalPrice = listing.price *
                    ((checkOutDate.getTime() - checkInDate.getTime()) / 86400000 + 1);
                const host = yield db.users.findOne({
                    _id: listing.host,
                });
                if (!host) {
                    throw new Error("the host either can't be found or is not connected with Stripe");
                }
                //await StripeApi.charge(totalPrice, source, "lmao");
                const insertRes = yield db.bookings.insertOne({
                    _id: new mongodb_1.ObjectID(),
                    listing: listing._id,
                    tenant: viewer._id,
                    checkIn,
                    checkOut,
                });
                const insertedBooking = insertRes.ops[0];
                yield db.users.updateOne({
                    _id: host._id,
                }, {
                    $inc: { income: totalPrice },
                });
                yield db.users.updateOne({
                    _id: viewer._id,
                }, {
                    $push: { bookings: insertedBooking._id },
                });
                yield db.listings.updateOne({
                    _id: listing._id,
                }, {
                    $set: { bookingsIndex },
                    $push: { bookings: insertedBooking._id },
                });
                return insertedBooking;
            }
            catch (error) {
                throw new Error(`Failed to create a booking: ${error}`);
            }
        }),
    },
    Booking: {
        id: (booking) => {
            return booking._id.toString();
        },
        listing: (booking, _args, { db }) => {
            return db.listings.findOne({ _id: booking.listing });
        },
        tenant: (booking, _args, { db }) => {
            return db.users.findOne({ _id: booking.tenant });
        },
    },
};
exports.resolvers = _.merge(viewerResolvers, userResolvers, listingResolvers, bookingResolvers);
