module.exports = {
    development: {
        driver: 'sqlite3',
        database: 'dev.sqlite'
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
