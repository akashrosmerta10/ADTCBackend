const mongoose = require("mongoose");
const { Schema } = mongoose;

const ModuleSchema = new Schema(
  {
    name: { type: String, required: true },
    summary: { type: String, required: true },
    url: { type: String, required: true },

    questionIds: [{ type: Schema.Types.ObjectId, ref: "Question" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Module", ModuleSchema);
