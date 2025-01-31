const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const mongoose = require("mongoose");
const authMiddleWare = require("./middlewares/auth");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb+srv://Prishasanthosh:prishasanthosh@cluster0.udjjrkz.mongodb.net/crowdfunding")
  .then(() => {
    console.log("Connected to database");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

// User schema
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

// Sign-up endpoint
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      id: uuidv4(),
      email,
      name,
      password: hashedPassword,
    });
    await newUser.save();
    res.json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ id: user.id }, "secret_key", { expiresIn: "1h" });
    res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Campaign schema
const campaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  goalAmount: { type: Number, required: true },
  currentAmount: { type: Number, default: 0 },
  creatorId: { type: String, required: true }
});
const Campaign = mongoose.model("Campaign", campaignSchema);

// Fundraiser schema
const fundraiserSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  fundsReq: { type: Number, required: true },
  collected: { type: Number, default: 0 },
  creatorId: { type: String, required: true }
});
const Fundraiser = mongoose.model("Fundraiser", fundraiserSchema);

app.post("/api/campaigns", authMiddleWare, async (req, res) => {
    const { title, description, goalAmount } = req.body;
  
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ message: "Title is required and should be at least 3 characters long" });
    }
  
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ message: "Description is required and should be at least 10 characters long" });
    }
  
    if (!goalAmount || typeof goalAmount !== 'number' || goalAmount <= 0) {
      return res.status(400).json({ message: "Goal amount must be a positive number" });
    }
  
    const creatorId = req.user?.id; 
    if (!creatorId) {
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }
  
    const newCampaign = new Campaign({
      id: uuidv4(),
      title,
      description,
      goalAmount,
      currentAmount: 0,
      creatorId,
    });
  
    try {
      await newCampaign.save();
      res.status(201).json({
        id: newCampaign.id,
        title: newCampaign.title,
        description: newCampaign.description,
        goalAmount: newCampaign.goalAmount,
        currentAmount: newCampaign.currentAmount,
      });
    } catch (err) {
      console.error("Error saving campaign:", err.message, err.stack);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  

// Get all campaigns
app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find();
    res.status(200).json(campaigns);
  } catch (error) {
    res.status(500).json({ message: "Error in fetching campaigns" });
  }
});

// Get campaign by ID
app.get("/api/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOne({ id });
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    res.status(200).json(campaign);
  } catch (error) {
    res.status(500).json({ message: "Error in fetching campaign" });
  }
});

// Auth middleware for validating JWT token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Get the token from the Authorization header
    
    if (!token) {
      return res.status(401).json({ message: "Token is required" });
    }
  
    jwt.verify(token, "secret_key", (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Invalid token" });
      }
      req.user = user;
      next(); // Proceed to the next middleware/route handler
    });
  };
  
  // User profile route to fetch user data
  app.get('/user-profile', authenticateToken, (req, res) => {
    const userId = req.user.id; // Extract user ID from the decoded JWT
  
    User.findOne({ id: userId })
      .then(user => {
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
  
        // Sending user data excluding sensitive information
        res.json({
          name: user.name,
          email: user.email,
          phone: user.phone, // Assuming phone is stored in the database
          fundsDonated: user.fundsDonated, // Assuming this field exists
          fundraisersCreated: user.fundraisersCreated // Assuming this field exists
        });
      })
      .catch(err => {
        res.status(500).json({ message: 'Error fetching user data' });
      });
  });
  

// Update campaign
app.put("/api/campaigns/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  const { title, description, goalAmount } = req.body;
  try {
    const updatedCampaign = await Campaign.findOneAndUpdate(
      { id },
      { title, description, goalAmount },
      { new: true }
    );
    if (!updatedCampaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    res.status(200).json(updatedCampaign);
  } catch (error) {
    res.status(500).json({ message: "Error in updating campaign" });
  }
});

// Delete campaign
app.delete("/api/campaigns/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCampaign = await Campaign.findOneAndDelete({ id });
    if (!deletedCampaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    res.status(200).json(deletedCampaign);
  } catch (error) {
    res.status(500).json({ message: "Error in deleting campaign" });
  }
});

// Contribution schema
const contributionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  campaignId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});
const Contribution = mongoose.model("Contribution", contributionSchema);

// Create contribution
app.post("/api/contributions", authMiddleWare, async (req, res) => {
  const { campaignId, amount } = req.body;
  const userId = req.user.id;

  try {
    const campaign = await Campaign.findOne({ id: campaignId });
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (campaign.currentAmount + amount <= campaign.goalAmount) {
      campaign.currentAmount += amount;
      await campaign.save();

      const newContribution = new Contribution({
        id: uuidv4(),
        campaignId,
        userId,
        amount
      });
      await newContribution.save();
      res.status(200).json({ message: "Contribution successful" });
    } else {
      return res.status(400).json({ message: "Contribution exceeds goal" });
    }

  } catch (error) {
    res.status(500).json({ message: "Error in making contribution" });
  }
});

// Get contributions by campaign ID
app.get("/api/contributions/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const contributions = await Contribution.find({ campaignId });
    res.status(200).json(contributions);
  } catch (error) {
    res.status(500).json({ message: "Error in fetching contributions" });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
