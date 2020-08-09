"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
const apollo_server_express_1 = require("apollo-server-express");
exports.typeDefs = apollo_server_express_1.gql `
  type Booking {
    id: ID!
    listing: Listing!
    tenant: User!
    checkIn: String!
    checkOut: String!
  }
  enum ListingType {
    HOUSE
    APARTMENT
    ROOM
  }

  enum ListingFilter {
    PRICE_HL
    PRICE_LH
  }
  type Listing {
    id: ID!
    title: String!
    description: String!
    image: String!
    host: User!
    type: ListingType!
    address: String!
    admin: String!
    country: String!
    city: String!
    bookings(limit: Int!, page: Int!): Bookings
    bookingsIndex: String!
    price: Int!
    numOfGuests: Int!
    numOfBeds: Int!
    numOfBedrooms: Int!
    numOfBathrooms: Int!
  }

  type Bookings {
    total: Int!
    result: [Booking!]!
  }

  type Listings {
    region: String
    total: Int!
    result: [Listing!]!
  }

  type User {
    id: ID!
    name: String!
    pfp: String!
    email: String!
    hasWallet: Boolean!
    income: Int
    bookings(limit: Int!, page: Int!): Bookings
    listings(limit: Int!, page: Int!): Listings!
  }
  input LogInput {
    code: String!
  }
  input ConnectStripeInput {
    code: String!
  }

  input NewListingInput {
    title: String!
    description: String!
    image: String!
    type: ListingType!
    address: String!
    price: Int!
    numOfGuests: Int!
    numOfBeds: Int!
    numOfBedrooms: Int!
    numOfBathrooms: Int!
  }

  input NewBookingInput {
    id: ID!
    source: String!
    checkIn: String!
    checkOut: String!
  }
  
  type Viewer {
    id: ID
    token: String
    avatar: String
    hasWallet: Boolean
    didRequest: Boolean!
  }

  type Query {
    authUrl: String!
    user(id: ID!): User!
    listing(id: ID!): Listing!
    listings(
      location: String
      filter: ListingFilter
      limit: Int!
      page: Int!
    ): Listings!
  }

  type Mutation {
    logIn(input: LogInput): Viewer!
    logOut: Viewer!
    connectStripe(input: ConnectStripeInput): Viewer!
    disconnectStripe: Viewer!
    newListing(input: NewListingInput) : Listing!
    bookListing(input: NewBookingInput): Booking!
  }
`;
