// SETUP BEGINS
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book";
const client = new MongoClient(mongoUri);
let db;

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
async function connect() {
    await client.connect();
    db = client.db(dbname);
}
connect();

// Routes
app.get('/', (req, res) => {
    res.json({ message: "Hello World!" });
});

// Recipes Routes
app.get("/recipes", async (req, res) => {
    try {
        const { tags, cuisine, ingredients, name } = req.query;
        let query = {};

        if (tags) {
            query['tags.name'] = { $in: tags.split(',') };
        }
        if (cuisine) {
            query['cuisine.name'] = { $regex: cuisine, $options: 'i' };
        }
        if (ingredients) {
            query['ingredients.name'] = { $all: ingredients.split(',').map(i => new RegExp(i, 'i')) };
        }
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }

        const recipes = await db.collection('recipes').find(query).project({
            name: 1,
            'cuisine.name': 1,
            'tags.name': 1,
            _id: 0
        }).toArray();
        
        res.json({ recipes });
    } catch (error) {
        console.error('Error searching recipes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/recipes', async (req, res) => {
    try {
        const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

        // Basic validation
        if (!name || !cuisine || !ingredients || !instructions || !tags) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
        if (!cuisineDoc) {
            return res.status(400).json({ error: 'Invalid cuisine' });
        }

        const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
        if (tagDocs.length !== tags.length) {
            return res.status(400).json({ error: 'One or more invalid tags' });
        }

        const newRecipe = {
            name,
            cuisine: { _id: cuisineDoc._id, name: cuisineDoc.name },
            prepTime,
            cookTime,
            servings,
            ingredients,
            instructions,
            tags: tagDocs.map(tag => ({ _id: tag._id, name: tag.name }))
        };

        const result = await db.collection('recipes').insertOne(newRecipe);
        res.status(201).json({ message: 'Recipe created successfully', recipeId: result.insertedId });
    } catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reviews Route
app.post('/recipes/:id/reviews', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { user, rating, comment } = req.body;

        if (!user || !rating || !comment) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newReview = {
            review_id: new ObjectId(),
            user,
            rating: Number(rating),
            comment,
            date: new Date()
        };

        const result = await db.collection('recipes').updateOne(
            { _id: new ObjectId(recipeId) },
            { $push: { reviews: newReview } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        res.status(201).json({ message: 'Review added successfully', reviewId: newReview.review_id });
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Routes
app.post('/users/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({ username, password: hashedPassword });
    res.status(201).send({ message: 'User created' });
});

app.post('/users/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.collection('users').findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET);
        res.send({ token });
    } else {
        res.status(401).send({ message: 'Invalid credentials' });
    }
});
app.get("/recipes/:id", async (req, res) => {
  try {
      const recipeId = req.params.id;
      const recipe = await db.collection("recipes").findOne({ _id: new ObjectId(recipeId) });
      
      if (!recipe) {
          return res.status(404).json({ error: "Recipe not found" });
      }
      
      res.json(recipe);
  } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});
app.put('/recipes/:id', async (req, res) => {
  try {
      const recipeId = req.params.id;
      const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

      // Basic validation
      if (!name || !cuisine || !ingredients || !instructions || !tags) {
          return res.status(400).json({ error: 'Missing required fields' });
      }

      const updatedRecipe = {
          name,
          cuisine, // Assuming you handle the cuisine object accordingly
          prepTime,
          cookTime,
          servings,
          ingredients,
          instructions,
          tags
      };

      const result = await db.collection('recipes').updateOne(
          { _id: new ObjectId(recipeId) },
          { $set: updatedRecipe }
      );

      if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ message: 'Recipe updated successfully' });
  } catch (error) {
      console.error('Error updating recipe:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
app.delete('/recipes/:id', async (req, res) => {
  try {
      const recipeId = req.params.id;
      const result = await db.collection('recipes').deleteOne({ _id: new ObjectId(recipeId) });

      if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});


// Middleware for token verification
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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
