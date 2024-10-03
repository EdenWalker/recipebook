const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const url = process.env.MONGO_URI;
const client = new MongoClient(url);

async function connect() {
    await client.connect();
}

async function getOrd() {
    await connect();
    return client.db('inventory').collection('orders');
}

async function getPro() {
    await connect();
    return client.db('inventory').collection('products');
}

async function getInv() {
    await connect();
    return client.db('inventory').collection('users');
}

module.exports = { getOrd, getPro, getInv };