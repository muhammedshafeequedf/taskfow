import mongoose, { Document, Schema } from 'mongoose';

export interface ICountry extends Document {
  iso2: string;
  iso3?: string;
  name: string;
  currencyCodes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const countrySchema = new Schema<ICountry>(
  {
    iso2: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    iso3: { type: String, uppercase: true, trim: true, minlength: 3, maxlength: 3, sparse: true },
    name: { type: String, required: true, trim: true },
    currencyCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

countrySchema.index({ name: 1 });

export const Country = mongoose.model<ICountry>('Country', countrySchema);
