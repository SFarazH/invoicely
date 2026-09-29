import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    // The editor's full design (page size, theme, components array). Left as
    // Mixed because each component type (text, image, table, totals, ...)
    // has a different shape of `props` — this is exactly the JSON blob the
    // existing frontend already builds and expects back unchanged.
    schema: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export default mongoose.models.Template || mongoose.model("Template", TemplateSchema);
