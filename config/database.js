module.exports = {
    development: {
        driver:   "mysql",
        host:     "localhost",
        post:     3306,
        database: "pind", 
        username: "pind",
        password: "p1nd"
    },
    test: {
        driver: 'sqlite3',
        database: 'test.sqlite'
    },
    production: {
        driver: 'sqlite3',
        database: 'prod.sqlite'
    }
};
