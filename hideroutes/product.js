const express = require('express');
const router = express.Router();
// const { getPro } = require('../models/product');
const { getPro } = require('../models/combined');


// Create a new product
router.post('/', async (req, res) => {
    const product = req.body;
    const collection = await getPro();
    await collection.insertOne(product);
    res.status(201).send(product);
});

// Read all products
router.get('/', async (req, res) => {
    const collection = await getPro();
    const products = await collection.find({}).toArray();
    res.send(products);
});

// Update a product
router.put('/:id', async (req, res) => {
    const collection = await getPro();
    const result = await collection.updateOne({ _id: new MongoClient.ObjectId(req.params.id) }, { $set: req.body });
    res.send(result);
});

// Delete a product
router.delete('/:id', async (req, res) => {
    const collection = await getPro();
    await collection.deleteOne({ _id: new MongoClient.ObjectId(req.params.id) });
    res.status(204).send();
});

// Search for products
router.get('/search', async (req, res) => {
    const query = req.query.q;
    const collection = await getPro();
    const products = await collection.find({ name: { $regex: query, $options: 'i' }}).toArray();
    res.send(products);
});

module.exports = router;
