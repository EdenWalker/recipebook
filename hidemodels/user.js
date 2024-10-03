const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const url = process.env.MONGO_URI;
const client = new MongoClient(url);

async function getInv() {
    await client.connect();
    return client.db('inventory').collection('users');
}

module.exports = { getInv };
