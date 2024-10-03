const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const { getInv } = require('../models/user');
const { getInv } = require('../models/combined');
const router = express.Router();


router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const collection = await getInv();
    const user = { username, password: hashedPassword };
    await collection.insertOne(user);
    res.status(201).send({ message: 'User created' });
});

router.post('/login', async (req, res) => {
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

router.get('/dashboard', authenticateToken, (req, res) => {
    res.send('Welcome to the dashboard!');
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.sendStatus(401); 
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.user = user;
        next(); 
    });
}
module.exports = router;
