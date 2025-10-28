
const axios = require('axios'); 
const checkAdminRole = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    const response = await axios.get(`${BASE_URL}/api/v1/users/roles/${userId}`); 
    const roles = response.data.roles;
     const allowedRoles = ["Admin", "Supervisor", "opsmanager", "centerhead"];

    const hasPermission = roles.some(role => allowedRoles.includes(role));
    console.log("permission",hasPermission)

    if (hasPermission) {
      return next(); 
    }

    // if (roles.includes('Admin')) {
    //   return next(); 
    // }

    return res.status(403).json({ message: 'Permission denied. Admin role required.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking roles' });
  }
};

module.exports = { checkAdminRole };
