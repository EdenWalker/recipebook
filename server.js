const express = require('express');
const bodyParser = require('body-parser');
// const productRoutes = require('./routes/product'); // in hidden
// const userRoutes = require('./routes/user'); // in hidden
// const orderRoutes = require('./routes/order'); // in hidden
const combinedRoutes = require('./routes/combined');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use('/combined',combinedRoutes);
// app.use('/products', productRoutes);// in hidden
// app.use('/users', userRoutes);// in hidden
// app.use('/orders', orderRoutes); // in hidden

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
