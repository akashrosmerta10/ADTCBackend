const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const uploadToS3Middleware = (...fields) => {
  return async (req, res, next) => {
    try {
      const uploadedFiles = [];
      const moduleId = req.body.moduleId;

      if (req.file) {
        uploadedFiles.push({ fieldname: req.file.fieldname, file: req.file });
      }

      if (req.files) {
        for (const field of fields) {
          if (req.files[field]) {
            req.files[field].forEach((file) => {
              uploadedFiles.push({ fieldname: field, file });
            });
          }
        }
      }

      if (uploadedFiles.length === 0) return next();

      for (const { fieldname, file } of uploadedFiles) {
        const fileExtension = file.originalname.split(".").pop();
        let uniqueKey;

        if (fieldname === "image") {
          const Title = req.body.title;
          uniqueKey = `Shikshan/courses/${Title}/${Title}.${fileExtension}`;
          req.body.courseImage = uniqueKey;
        } else if (fieldname === "profilePhoto" && req.body.email) {
          const email = req.body.email.replace(/[@.]/g, "_");

          uniqueKey = `Shikshan/profile/${email}/${fieldname}.${fileExtension}`;
          req.body[fieldname] = uniqueKey;
        } else if (fieldname === "docPhoto" && req.body.email) {
          const email = req.body.email.replace(/[@.]/g, "_");
          const index = uploadedFiles.findIndex((u) => u.file === file);
          const docType =
            Array.isArray(req.body.docType) && req.body.docType[index]
              ? req.body.docType[index]
              : `doc_${index + 1}`;

          uniqueKey = `Shikshan/profile/${email}/${docType}.${fileExtension}`;

          if (!req.body.docPhoto) req.body.docPhoto = [];
          req.body.docPhoto.push(uniqueKey);
        } else if (fieldname === "licenceFile" && req.body.email) {
          const email = req.body.email.replace(/[@.]/g, "_");
          uniqueKey = `Shikshan/profile/${email}/licence.${fileExtension}`;
          req.body.licenceFile = uniqueKey;
        } else if (fieldname === "questionimage" && moduleId) {
          const uniqueCode = `Q${Math.floor(100 + Math.random() * 900)}`;
          const ext = file.originalname.split(".").pop();

          uniqueKey = `Shikshan/questions/${moduleId}/${uniqueCode}.${ext}`;
         req.body.question = req.body.question 
          req.body.question.imageUrl = uniqueKey;
        } else if (fieldname === "categoryImage") {
  const Category = req.body.name;
  uniqueKey = `Shikshan/category/${Category}.${fileExtension}`;
  req.body.categoryImage = uniqueKey;
}


        const uploadParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: uniqueKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        await s3.send(new PutObjectCommand(uploadParams));
      }

      next();
    } catch (error) {
      console.error("S3 Upload Error:", error);
      res.status(500).json({
        message: "Error uploading image to S3",
        error: error.message,
      });
    }
  };
};

const getSignedImageUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
};

const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  try {
    await s3.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
};

module.exports = {
  uploadToS3Middleware,
  getSignedImageUrl,
  deleteFromS3,
};
