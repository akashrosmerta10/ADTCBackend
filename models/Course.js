const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  courseKey: {
    type: String,
    unique: true,
    required: true,
  },
    title: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    subCategory: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price must be a positive number'],
    },
    // creator: {
    //   type: String,
    //   required: true,
    // },
    status: {
      type: Boolean,
      required: true,
      default: true,
    },
   kycRequired: {
  type: Boolean,
  // required: true,
},

    currency: { type: String, default: "INR" },
    modules: [{ 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true
    }],
    tags: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag',
      required: true
    }],
    faq:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faq'
    }],
    ratings:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ratings'
    }]

}, { timestamps: true });
// CourseSchema.pre('validate', async function (next) {
//   if(!this.courseId) {
//      const sanitizedTitle = this.title
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, '_') 
//       .replace(/_+/g, '_'); 

//     const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
//     this.courseId = `COURSE_${sanitizedTitle}_${randomSuffix}`;
//   }
//   next();
// })

module.exports = mongoose.model('Course', CourseSchema);