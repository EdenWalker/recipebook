const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const { getOrd } = require('../models/order');
// const { getPro } = require('../models/product');
// const { getInv } = require('../models/user');
const { getOrd, getPro, getInv } = require('../models/combined');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Middleware to authenticate tokens
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token

    if (!token) return res.sendStatus(401); // No token provided

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token invalid
        req.user = user; // Attach user info to request
        next(); // Proceed to the next middleware or route handler
    });
}

// Orders Routes

// Create a new order
router.post('/orders', async (req, res) => {
    try {
        const orderItems = req.body.order.items;

        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).send({ message: 'Invalid order items' });
        }

        const productCollection = await getPro();
        const itemsDetails = [];
        let totalPrice = 0;
        const invoiceNumber = `INV-${Date.now()}`;

        for (const item of orderItems) {
            const product = await productCollection.findOne({ sku: item.sku });

            if (!product) {
                return res.status(404).send({ message: `Product ${item.itemName} not found` });
            }

            if (product.inventoryCount < item.quantity) {
                return res.status(400).send({ message: `Insufficient inventory for ${item.itemName}` });
            }

            const itemTotalPrice = product.basePrice * item.quantity;
            totalPrice += itemTotalPrice;

            // Add item details for the response
            itemsDetails.push({
                itemName: item.itemName,
                type: item.type,
                brand: item.brand,
                weight: item.weight,
                sku: item.sku,
                quantity: item.quantity
            });

            // Update the inventory count
            await productCollection.updateOne(
                { sku: item.sku },
                { $inc: { inventoryCount: -item.quantity } }
            );
        }

        // Create the final order object
        const order = {
            invoiceNumber,
            order: {
                items: itemsDetails
            },
            totalPrice,
            orderDate: new Date(),
            status: 'Pending'
        };

        const collection = await getOrd();
        await collection.insertOne(order);

        res.status(201).send(order);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Read all orders
router.get('/orders', async (req, res) => {
    const collection = await getOrd();
    const orders = await collection.find({}).toArray();
    res.send(orders);
});

// Update an order
router.put('/orders/:invoiceNumber', async (req, res) => {
    const invoiceNumber = req.params.invoiceNumber;
    const updatedOrder = req.body.order;

    const collection = await getOrd();
    const existingOrder = await collection.findOne({ invoiceNumber });

    if (!existingOrder) {
        return res.status(404).send({ message: 'Order not found' });
    }

    const productCollection = await getPro();
    const inventoryUpdates = [];
    let totalPrice = 0;

    for (const item of updatedOrder.items) {
        const product = await productCollection.findOne({ sku: item.sku });

        if (!product) {
            return res.status(404).send({ message: `Product ${item.itemName} not found` });
        }

        if (product.inventoryCount < item.quantity) {
            return res.status(400).send({ message: `Insufficient inventory for ${item.itemName}` });
        }

        const previousQuantity = existingOrder.order.items.find(i => i.sku === item.sku)?.quantity || 0;
        const quantityDifference = item.quantity - previousQuantity;

        if (quantityDifference !== 0) {
            inventoryUpdates.push({
                sku: item.sku,
                difference: -quantityDifference
            });
        }

        totalPrice += product.basePrice * item.quantity;
    }

    const updatedData = {
        ...existingOrder,
        order: updatedOrder,
        totalPrice,
        orderDate: new Date()
    };

    await collection.updateOne({ invoiceNumber }, { $set: updatedData });

    for (const update of inventoryUpdates) {
        await productCollection.updateOne(
            { sku: update.sku },
            { $inc: { inventoryCount: update.difference } }
        );
    }

    res.status(200).send(updatedData);
});

// Delete an order
router.delete('/orders/:invoiceNumber', async (req, res) => {
    const invoiceNumber = req.params.invoiceNumber;

    const collection = await getOrd();
    const existingOrder = await collection.findOne({ invoiceNumber });

    if (!existingOrder) {
        return res.status(404).send({ message: 'Order not found' });
    }

    await collection.deleteOne({ invoiceNumber });
    res.status(204).send();
});

// Search for orders
router.get('/orders/search', async (req, res) => {
    const query = req.query.q;
    const collection = await getOrd();
    const orders = await collection.find({ orderName: { $regex: query, $options: 'i' } }).toArray();
    res.send(orders);
});

// Products Routes

// Create a new product
router.post('/products', async (req, res) => {
    const product = req.body;
    const collection = await getPro();
    await collection.insertOne(product);
    res.status(201).send(product);
});

// Read all products
router.get('/products', async (req, res) => {
    const collection = await getPro();
    const products = await collection.find({}).toArray();
    res.send(products);
});

// Update a product
router.put('/products/:id', async (req, res) => {
    const collection = await getPro();
    const result = await collection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
    );
    res.send(result);
});

// Delete a product
router.delete('/products/:id', async (req, res) => {
    const collection = await getPro();
    await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(204).send();
});

// Search for products
router.get('/products/search', async (req, res) => {
    const query = req.query.q;
    const collection = await getPro();
    const products = await collection.find({ name: { $regex: query, $options: 'i' } }).toArray();
    res.send(products);
});

// User Routes

// User signup
router.post('/users/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const collection = await getInv();
    const user = { username, password: hashedPassword };
    await collection.insertOne(user);
    res.status(201).send({ message: 'User created' });
});

// User login
router.post('/users/login', async (req, res) => {
    const { username, password } = req.body;
    const collection = await getInv();
    const user = await collection.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET);
        res.send({ token });
    } else {
        res.status(401).send({ message: 'Invalid credentials' });
    }
});

// Authenticated route example
router.get('/users/dashboard', authenticateToken, (req, res) => {
    res.send('Welcome to the dashboard!');
});

module.exports = router;
