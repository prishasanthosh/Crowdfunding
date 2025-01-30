var express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const authMiddleWare = require('./middlewares/auth');
const cors = require('cors');
app.use(cors());
app.use(express.json());

const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://Prishasanthosh:prishasanthosh@cluster0.udjjrkz.mongodb.net/crowdfunding").then(() => {
    console.log("Connected to database");
});

const userSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    password: String,
});
const User = mongoose.model("User", userSchema);

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

const campaignSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    goalAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    creatorId: { type: String, required: true }
});
const Campaign = mongoose.model("Campaign", campaignSchema);

app.post("/api/campaigns", authMiddleWare, async (req, res) => {
    const { title, description, goalAmount } = req.body;
    const userId = req.user.id;
    try {
        const newCampaign = new Campaign({
            id: uuidv4(),
            title,
            description,
            goalAmount,
            creatorId: userId
        });
        const savedCampaign = await newCampaign.save();
        res.status(200).json(savedCampaign);
    } catch (error) {
        res.status(500).json({ message: "Error in creating campaign" });
    }
});

app.get("/api/campaigns", async (req, res) => {
    try {
        const campaigns = await Campaign.find();
        res.status(200).json(campaigns);
    } catch (error) {
        res.status(500).json({ message: "Error in fetching campaigns" });
    }
});

app.get("/api/campaigns/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await Campaign.findOne({ id });
        if (!campaign) {
            res.status(404).json({ message: "Campaign not found" });
        }
        res.status(200).json(campaign);
    } catch (error) {
        res.status(500).json({ message: "Error in fetching campaign" });
    }
});

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

const contributionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    campaignId: { type: String, required: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});
const Contribution = mongoose.model("Contribution", contributionSchema);

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

app.get("/api/contributions/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    try {
        const contributions = await Contribution.find({ campaignId });
        res.status(200).json(contributions);
    } catch (error) {
        res.status(500).json({ message: "Error in fetching contributions" });
    }
});

app.listen(3000, () => {
    console.log("Server is running at port 3000");
});
