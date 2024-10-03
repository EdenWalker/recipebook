const express = require('express');
const router = express.Router();
// const { getOrd } = require('../models/order');
// const { getPro } = require('../models/product');
const { getOrd, getPro } = require('../models/combined');
const { ObjectId } = require('mongodb');

// Create a new order
router.post('/', async (req, res) => {
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
router.get('/', async (req, res) => {
    const collection = await getOrd();
    const orders = await collection.find({}).toArray();
    res.send(orders);
});

// Update an order
router.put('/:invoiceNumber', async (req, res) => {
  const invoiceNumber = req.params.invoiceNumber;
  const updatedOrder = req.body.order; // Expecting the new order structure

  // Check if the order exists
  const collection = await getOrd();
  const existingOrder = await collection.findOne({ invoiceNumber });

  if (!existingOrder) {
      return res.status(404).send({ message: 'Order not found' });
  }

  // Validate new items and prepare for inventory update
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

      // Prepare inventory update
      if (quantityDifference !== 0) {
          inventoryUpdates.push({
              sku: item.sku,
              difference: -quantityDifference // Update inventory
          });
      }

      // Calculate total price for the updated order
      totalPrice += product.basePrice * item.quantity;
  }

  // Update the order
  const updatedData = {
      ...existingOrder,
      order: updatedOrder,
      totalPrice,
      orderDate: new Date()
  };

  await collection.updateOne({ invoiceNumber }, { $set: updatedData });

  // Update the inventory counts
  for (const update of inventoryUpdates) {
      await productCollection.updateOne(
          { sku: update.sku },
          { $inc: { inventoryCount: update.difference } }
      );
  }

  res.status(200).send(updatedData);
});
// Delete an order
router.delete('/:invoiceNumber', async (req, res) => {
  const invoiceNumber = req.params.invoiceNumber;

  // Check if the order exists
  const collection = await getOrd();
  const existingOrder = await collection.findOne({ invoiceNumber });

  if (!existingOrder) {
      return res.status(404).send({ message: 'Order not found' });
  }

  await collection.deleteOne({ invoiceNumber });
  res.status(204).send();
});

// Search for orders (if applicable)
router.get('/search', async (req, res) => {
    const query = req.query.q;
    const collection = await getOrd();
    const orders = await collection.find({ orderName: { $regex: query, $options: 'i' }}).toArray();
    res.send(orders);
});

module.exports = router;
