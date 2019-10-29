const mongoose = require("../database");

const Schema = mongoose.Schema;

const clientSchema = new Schema(
  {
    tel: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      default: 1,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const Client = mongoose.model("Client", clientSchema);
module.exports = Client;