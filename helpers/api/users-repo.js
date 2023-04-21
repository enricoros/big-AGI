// users in JSON file for simplicity, store in a db for production applications
let users = []; 
users.push({ id: 1, username: 'test', password: process.env.USER_PASSWORD, firstName: 'Test', lastName: 'User' });  

export const usersRepo = {
    getAll: () => users,
    find: x => users.find(x)
};
