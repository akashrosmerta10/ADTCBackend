const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    fatherOrHusbandName: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    dob: { type: Date, required: true },

    docPhoto: [
    {
      docType: { type: String, required: true }, 
      docPhoto: { type: String, required: true }, 
    },
  ],
    address: {
      houseno: { type: String, required: true },        
      street: { type: String, required: true },        
      city: { type: String, required: true },           
      pincode: { type: String, required: true },   
      state: { type: String, required: true },    
      country: { type: String, required: true  },                        
    },
    education: {
       degree: { type: String, required: true },      
       stream: { type: String, required: true }, 
        institution: { type: String, required: true },  
        graduationyear: { type: Number, required: true },
        gpa: { type: Number },                           
        certifications: { type: String },            
        courses: { type: String },                     
        achievements: { type: String },      
      
    },

    currentAddress: {
      Docandsimilaraddress: {type: String },
      houseno: { type: String },
      street: { type: String,required: true  },
      city: { type: String, required: true  },
      pincode: { type: String, required: true  },
      state: { type: String, required: true }, 
      country: { type: String },
    },

    hasLicence: { type: String, required: true  },
    licenceType: { type: String, enum: ["learner", "driving"], default: null },
    licenceFile: { type: String, default: null },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

const KYCLogs = mongoose.model("KYCLogs", kycSchema);
module.exports = KYCLogs;
