const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../../data/users.json');
const postsPath = path.join(__dirname, '../../data/posts.json');
const commentsPath = path.join(__dirname, '../../data/comments.json');

function load(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const db = {
    users: load(usersPath),
    posts: load(postsPath),
    comments: load(commentsPath),

    saveUsers(data) {
        this.users = data;
        save(usersPath, data);
    },

    savePosts(data) {
        this.posts = data;
        save(postsPath, data);
    },

    saveComments(data) {
        this.comments = data;
        save(commentsPath, data);
    },

    addUser(user) {
        this.users.push(user);
        save(usersPath, this.users);
    },

    addPost(post) {
        this.posts.push(post);
        save(postsPath, this.posts);
    },

    addComment(comment) {
        this.comments.push(comment);
        save(commentsPath, this.comments);
    }
};

module.exports = db;
