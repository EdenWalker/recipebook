const express = require('express');
const bodyParser = require('body-parser');
// const productRoutes = require('./routes/product');
// const userRoutes = require('./routes/user');
// const orderRoutes = require('./routes/order'); 
const combinedRoutes = require('./routes/combined');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use('/combined',combinedRoutes);
// app.use('/products', productRoutes);
// app.use('/users', userRoutes);
// app.use('/orders', orderRoutes); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
