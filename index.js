const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.avssyq6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const classesCollection = client.db("assignment-12").collection("classes");
    const usersCollection = client.db("assignment-12").collection("users");
    const teachOnCollection = client.db("assignment-12").collection("teachOn");
    const paymentCollection = client.db("assignment-12").collection("payment");
    const feedbackCollection = client
      .db("assignment-12")
      .collection("feedback");
    const assignmentCollection = client
      .db("assignment-12")
      .collection("assignment");
    const assignmentSubmitCollection = client
      .db("assignment-12")
      .collection("assignmentSubmit");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        console.log("you are not admin");
        res.status(401).send({ message: "forbidden access" });
      }
      next();
    };

    // users
    app.get("/users" ,  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    app.post("/users", verifyToken, verifyAdmin, async (req, res) => {
      const info = req.body;
      const result = await usersCollection.insertOne(info);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    app.get("/class/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });
    app.get("/teachOn", verifyToken, verifyAdmin, async (req, res) => {
      const result = await teachOnCollection.find().toArray();
      res.send(result);
    });
    app.get("/teachOn/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await teachOnCollection.findOne(query);
      // console.log("ottoi result ", result);
      res.send(result);
    });
    app.post("/teachOn", async (req, res) => {
      const info = req.body;
      const result = await teachOnCollection.insertOne(info);
      res.send(result);
    });
    // approved
    app.patch("/teachOn/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "accepted",
        },
      };
      const result = await teachOnCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // rejected
    app.patch(
      "/teachOnRejected/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await teachOnCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.post("/assignmentSubmit", async (req, res) => {
      const info = req.body;
      const result = await assignmentSubmitCollection.insertOne(info);
      res.send(result);
    });

    app.get("/assignmentSubmit/:title", async (req, res) => {
      const title = req.params.title;
      console.log("title", title);
      const query = { title: title };
      const result = await assignmentSubmitCollection.find(query).toArray();
      console.log("result", result);
      res.send(result);
    });
    // feedback
    app.post("/users/feedback", async (req, res) => {
      const info = req.body;
      const result = await feedbackCollection.insertOne(info);
      res.send(result);
    });
    app.get("/users/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      console.log("result ", result);
      res.send(result);
    });

    // TODO : -----------
    app.get('/payment' , async(req , res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })
    app.post("/payment", async (req, res) => {
      const info = req.body;
      const result = await paymentCollection.insertOne(info);
      res.send(result);
    });
    app.patch("/enrollUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const singleClass = await classesCollection.findOne(filter);
      const enroll = parseInt(singleClass.total_enrolment);
      const newEnroll = enroll ? enroll + 1 : 0 + 1;
      // console.log(enroll, newEnroll);

      const updatedDoc = {
        $set: {
          total_enrolment: newEnroll,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // dashboard
    // enroll
    app.get("/dashboard/enrollClass/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my-enroll/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.findOne(query);
      res.send(result);
    });

    // teacher related api
    app.post("/users/assignment", async (req, res) => {
      const info = req.body;
      const result = await assignmentCollection.insertOne(info);
      res.send(result);
    });
    app.get("/users/assignment/:title", async (req, res) => {
      const title = req.params.title;
      const query = { title };
      const result = await assignmentCollection.find(query).toArray();
      // console.log("ottoi : ", result);
      res.send(result);
    });

    app.post("/addClass", async (req, res) => {
      const info = req.body;
      const result = await classesCollection.insertOne(info);
      res.send(result);
    });
    app.get("/users/teacher/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let teacher = false;
      if (user) {
        teacher = user?.role === "teacher";
      }
      res.send({ teacher });
    });
    app.get("/users/teacherClasses/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/users/teacherClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(filter);
      res.send(result);
    });
    app.get("/users/teacherClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });
    app.patch("/updateClass/:id", async (req, res) => {
      const info = req.body;
      // console.log("info", info);
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: info.name,
          email: info.email,
          title: info.title,
          price: info.price,
          image: info.image,
          short_description: info.short_description,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // admin related api
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/admin/classes/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "accepted",
          },
        };
        const result = await classesCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/admin/classes/Rejected/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await classesCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello developer");
});

app.listen(port, () => {
  console.log(`the port is running on ${port}`);
});
