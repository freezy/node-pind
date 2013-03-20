load('application');

before(loadTable, {
    only: ['show', 'edit', 'update', 'destroy']
    });

action('new', function () {
    this.title = 'New table';
    this.table = new Table;
    render();
});

action(function create() {
    Table.create(req.body.Table, function (err, table) {
        respondTo(function (format) {
            format.json(function () {
                if (err) {
                    send({code: 500, error: table && table.errors || err});
                } else {
                    send({code: 200, data: table.toObject()});
                }
            });
            format.html(function () {
                if (err) {
                    flash('error', 'Table can not be created');
                    render('new', {
                        table: table,
                        title: 'New table'
                    });
                } else {
                    flash('info', 'Table created');
                    redirect(path_to.tables);
                }
            });
        });
    });
});

action(function index() {
    this.title = 'Tables index';
    Table.all(function (err, tables) {
        switch (params.format) {
            case "json":
                send({code: 200, data: tables});
                break;
            default:
                render({
                    tables: tables
                });
        }
    });
});

action(function show() {
    this.title = 'Table show';
    switch(params.format) {
        case "json":
            send({code: 200, data: this.table});
            break;
        default:
            render();
    }
});

action(function edit() {
    this.title = 'Table edit';
    switch(params.format) {
        case "json":
            send(this.table);
            break;
        default:
            render();
    }
});

action(function update() {
    var table = this.table;
    this.title = 'Edit table details';
    this.table.updateAttributes(body.Table, function (err) {
        respondTo(function (format) {
            format.json(function () {
                if (err) {
                    send({code: 500, error: table && table.errors || err});
                } else {
                    send({code: 200, data: table});
                }
            });
            format.html(function () {
                if (!err) {
                    flash('info', 'Table updated');
                    redirect(path_to.table(table));
                } else {
                    flash('error', 'Table can not be updated');
                    render('edit');
                }
            });
        });
    });
});

action(function destroy() {
    this.table.destroy(function (error) {
        respondTo(function (format) {
            format.json(function () {
                if (error) {
                    send({code: 500, error: error});
                } else {
                    send({code: 200});
                }
            });
            format.html(function () {
                if (error) {
                    flash('error', 'Can not destroy table');
                } else {
                    flash('info', 'Table successfully removed');
                }
                send("'" + path_to.tables + "'");
            });
        });
    });
});

function loadTable() {
    Table.find(params.id, function (err, table) {
        if (err || !table) {
            if (!err && !table && params.format === 'json') {
                return send({code: 404, error: 'Not found'});
            }
            redirect(path_to.tables);
        } else {
            this.table = table;
            next();
        }
    }.bind(this));
}
