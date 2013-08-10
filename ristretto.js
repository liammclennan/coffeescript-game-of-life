/*
Copyright 2012 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Ristretto

Contains runtime type contracts for Javascript.

Authors: Samuel Li <samli@codesphere.com> and Shane Stephens <shans@chromium.org>
*/

(function(){

function Label(name) {
    this.name = name;
    this.polarity = true;
    this.toString = function() { return (this.polarity ? "" : "~") + this.name; }
    this.complement = function() { 
        var label = new Label(name);
        label.polarity = !this.polarity;
        return label;
    }
}

function Contract(label) {
    this.restrict = null;
    this.relax = null;
    this.label = label;
    this.fail = function() { throw TypeError(this.label.toString()); }
    this.swap = function() { this.label.swap(); }
}

function getClass(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

function is(type, obj) {
    return obj !== null && getClass(obj) === type;
}

function IntegerContract(label) {
    Contract.bind(this)(label);
    this.restrict = function(x) {
        if (is('Number', x) && Math.round(x) == x) {
            return x;
        } else {
            this.fail();
        }
    }
    this.relax = this.restrict;
}

IntegerContract.prototype.__proto__ = Contract.prototype;

function IntegerContractFactory() {
    var f = function(label) {
        return new IntegerContract(label);
    }
    f.repr = function() {
        return "IntegerContractFactory()";
    }
    return f;
}

function NumberContract(label) {
    Contract.bind(this)(label);
    this.restrict = function(x) {
        if (is('Number', x)) {
            return x;
        } else {
            this.fail();
        }
    }
    this.relax = this.restrict;
}

NumberContract.prototype.__proto__ = Contract.prototype;

function NumberContractFactory() {
    var f = function(label) {
        return new NumberContract(label);
    }
    f.repr = function() {
        return "NumberContractFactory()";
    }
    return f;
}

function StringContract(label) {
    Contract.bind(this)(label);
    this.restrict = function(x) {
        if (is('String', x)) {
            return x;
        } else {
            this.fail();
        }
    }
    this.relax = this.restrict;
}

StringContract.prototype.__proto__ = Contract.prototype;

function StringContractFactory() {
    var f = function(label) {
        return new StringContract(label);
    }
    f.repr = function() {
        return "StringContractFactory()";
    }
    return f;
}

function BooleanContract(label) {
    Contract.bind(this)(label);
    this.restrict = function(x) {
        if (is('Boolean', x)) {
            return x;
        } else {
            this.fail();
        }
    }
    this.relax = this.restrict;
}

BooleanContract.prototype.__proto__ = Contract.prototype;

function BooleanContractFactory() {
    var f = function(label) {
        return new BooleanContract(label);
    }
    f.repr = function() {
        return "BooleanContractFactory()";
    }
    return f;
}

function UnitContract(label) {
    Contract.bind(this)(label);
    this.restrict = function(x) {
        if (is('Undefined', x)) {
            return x;
        } else {
            this.fail();
        }
    }
    this.relax = this.restrict;
}

UnitContract.prototype.__proto__ = Contract.prototype;

function UnitContractFactory() {
    var f = function(label) {
        return new UnitContract(label);
    }
    f.repr = function() {
        return "UnitContractFactory()";
    }
    return f;
}

function ListContract(label, itemContract) {
    Contract.bind(this)(label);
    var itemContract = itemContract;

    this.restrict = function(x) {
        var out = [];
        if (!x || x.length === undefined) {
            this.fail();
        }
        for (var i = 0; i < x.length; i++) {
            out.push(itemContract.restrict(x[i]));
        }

        // Overwriting push function.
        out.push = function (item) {
            // In the case of variable contracts being used an item 
            // must first be relaxed before being restricted. We need
            // to do this to all elements so homogenous types are ensured.
            for (var i = 0; i < this.length; i++) {
                this[i] = itemContract.relax(this[i]);
            }
            item = itemContract.relax(item);
            item = itemContract.restrict(item);
            for (var i = 0; i < this.length; i++) {
                this[i] = itemContract.restrict(this[i]);
            }
            this[this.length] = item;
            return this.length;
        }
        return out;
    }

    this.relax = function(x) {
        var out = [];
        if (!x || x.length === undefined) {
            this.fail();
        }
        for (var i = 0; i < x.length; i++) {
            out.push(itemContract.relax(x[i]));
        }
        out.push = x.__proto__.push;
        return out;
    }
}

ListContract.prototype.__proto__ = Contract.prototype;

function ListContractFactory(itemContractFactory) {
    var f = function(label) {
        return new ListContract(label, itemContractFactory(label));
    }
    f.repr = function() {
        return "ListContractFactory(" + itemContractFactory.repr() + ")";
    }
    return f;
}

function MapContract(label, keyContract, valueContract) {
    Contract.bind(this)(label);

    this.restrict = function(x) {
        if (!x) { this.fail(); }
        var out = {}
        for (var key in x) {
            out[keyContract.restrict(key)] = valueContract.restrict(x[key]);
        }
        return out;
    }

    this.relax = function(x) {
        if (!x) { this.fail(); }
        var out = {}
        for (var key in x) {
            out[keyContract.relax(key)] = valueContract.relax(x[key]);
        }
        return out;
    }
}

MapContract.prototype.__proto__ = Contract.prototype;

function MapContractFactory(keyContractFactory, valueContractFactory) {
    var f = function(label) {
        return new MapContract(label, keyContractFactory(label), valueContractFactory(label));
    }
    f.repr = function() {
        return "MapContractFactory(" + keyContractFactory.repr() + ", " + valueContractFactory.repr() + ")";
    }
    return f;
}

var cryptographicKey = 0;

function ForAllContract(label, body) {
    Contract.bind(this)(label);

    this.restrict = function(x) {
        var lock = {key: cryptographicKey++, type: null, ref: 0};
        return body(lock)(label).restrict(x);
    }

    this.relax = function(x) {
        var lock = {key: cryptographicKey++, type: null, ref: 0};
        return body(lock)(label).relax(x);
    }
}

ForAllContract.prototype.__proto__ = Contract.prototype;

function ForAllContractFactory(body) {
    var f = function(label) {
        return new ForAllContract(label, body);
    }
    f.repr = function() {
        return "ForAllContractFactory(" + body + ")";
    }
    return f;
}

function Seal(lock, value) {
    this.lock = lock;
    this.value = value;
}

function VariableContract(label, lock) {
    Contract.bind(this)(label);

    this.relax = function(x) {
        // Need to keep a ref count to allow key to be reused
        if (lock.ref == 0) {
            lock.type = getClass(x);
        } else if (lock.type != getClass(x)) {
            lock.ref = 0;
            this.fail();
        }
        lock.ref++;
        return new Seal(lock, x);
    }

    this.restrict = function(sealedX) {
        lock.ref--;
        if (!sealedX.lock) {
            this.fail();
        } else if (lock.key == sealedX.lock.key) {
            return sealedX.value;
        } else {
            this.fail();
        }
    }
}

VariableContract.prototype.__proto__ = Contract.prototype;

function VariableContractFactory(lock) {
    return function(label) {
        return new VariableContract(label, lock);
    }
}

function VariableContractFactoryPlaceholder(name) {
    var obj = {};
    obj.repr = function() { return "VariableContractFactory(" + name + ")"; }
    return obj;
}

// input: a function that takes a variable number of arguments
// output: FunctionContract(_, first arg type, result type).restrict(input)
// desired behaviour of output: a function that takes a single argument of appropriate type
// and if result is a FunctionContract returns a suspension, else returns the result.
function FunctionContract(label, domain, range) {
    Contract.bind(this)(label);
    this.domain = domain;
    this.range = range;

    // The parameter numArgs specifies the number of arguments that should be expected.
    // If it is the last argument, then we simply call the function. If numArgs is not
    // specified, the number of arguments is predicted and used.
    this.restrict = function(f, numArgs) {
        if (!is('Function', f)) { this.fail(); }
        // Only adds an extra layer if the range is a function, the domain isn't an EmptyContract
        // and if num args is provided that there is more than 1 arg required. If num args isn't provided
        // we simply try to infer the number of arguments.
        // TODO: Simplify logic here
        if (range.__proto__.constructor == FunctionContract &&
                domain.__proto__.constructor != EmptyContract &&
                (numArgs === undefined || numArgs > 1) &&
                (numArgs !== undefined || f.length > 1 || (f.length == 0))) {
            if (numArgs === undefined) {
                numArgs = f.length;
            }
            // This is the restricted version of the function - i.e. it relaxes inputs and restricts the
            // output.
            return function() {
                var args = Array.prototype.slice.apply(arguments);
                // take the args and apply the domain check to the first one.
                // in the simple case, we want a function that takes an arg
                // and returns f(args ++ arg).

                // This is the restricted output of the function.  This actually recursively
                // restricts function ranges until it hits a range that is not a function, so that
                // every input argument gets relaxed and the final output gets restricted appropriately.
                // This only supports unary functions - i.e. if I have f :: A -> B -> C -> D then I 
                // expect it to be called f(a)(b)(c).
                var out = range.restrict(
                    function() {
                        var args2 = Array.prototype.slice.apply(arguments);
                        args2 = [domain.relax(args[0])].concat(args2);
                        if (domain.__proto__.constructor == ObjectContract) {
                            domain.restrict(args[0]);
                        }
                        return f.apply(null, args2)
                    }, numArgs == 0 ? undefined : numArgs - 1
                );

                // We obviously want to preserve javascript behaviour of allowing multiple arguments
                // to be supplied to functions, so this converts f(a, b, c) to f(a)(b)(c).
                for (var i = 1; i < args.length; i++) {
                    out = out(args[i]);
                }

                return out;
            }
        } else {
            return function(x) {
                var args = Array.prototype.slice.apply(arguments);
                if (domain.__proto__.constructor == EmptyContract && args.length > 1) {
                    this.fail();
                }
                var restOfArgs = args.slice(1);
                var result = range.restrict(f(domain.relax(x)));
                if (domain.__proto__.constructor == ObjectContract) {
                    domain.restrict(x);
                }
                if (restOfArgs.length == 0) {
                    return result;
                }
                return result.apply(undefined, restOfArgs);
            }
        }
    }

    this.relax = function(f, numArgs) {
        if (!is('Function', f)) { this.fail(); }
        if (range.__proto__.constructor == FunctionContract &&
                domain.__proto__.constructor != EmptyContract &&
                (numArgs === undefined || numArgs > 1) &&
                (numArgs !== undefined || f.length > 1 || (f.length == 0))) {
            if (numArgs === undefined) {
                numArgs = f.length;
            }
            return function() {
                var args = Array.prototype.slice.apply(arguments);
                var out = range.relax(
                        function() {
                        var args2 = Array.prototype.slice.apply(arguments);
                        args2 = [domain.restrict(args[0])].concat(args2);
                        return f.apply(null, args2)
                        }, numArgs - 1
                        );
                for (var i = 1; i < args.length; i++) {
                    out = out(args[i]);
                }

                return out;
            }
        } else {
            return function(x) {
                // Rest of the arguments are captured and we continue to apply
                // arguments in order to preserve identical behaviour in currying.
                var args = Array.prototype.slice.apply(arguments);
                if (domain.__proto__.constructor == EmptyContract && args.length > 1) {
                    this.fail();
                }
                var restOfArgs = args.slice(1);
                var result = range.relax(f(domain.restrict(x)));
                if (restOfArgs.length == 0) {
                    return result;
                }
                return result.apply(undefined, restOfArgs);
            }
        }
    }
}

FunctionContract.prototype.__proto__ = Contract.prototype;

function FunctionContractFactory(domainFactory, rangeFactory, isRet) {
    var f = function(label) {
        return new FunctionContract(label, domainFactory(label), rangeFactory(label.complement()), isRet);
    }
    f.repr = function() {return "FunctionContractFactory(" + domainFactory.repr() + ", " + rangeFactory.repr() + ")"};
    return f;
}

function ObjectContract(label, name, fields) {
    Contract.bind(this)(label);
    this.fields = fields;
    this.name = name;
    this.lock = cryptographicKey++;

    this.restrict = function(x) {
        if (!is('Object', x)) { this.fail(); }
        if (this.name && x.__proto__.constructor.name != this.name) { this.fail(); }
        var o = new Object();
        for (var i = 0; i < this.fields.length; i++) {
            var fieldName = this.fields[i].name;
            var contract = this.fields[i].contract(label);
            var infield = x[fieldName];

            if (infield != null && infield.bind) {
                infield = infield.bind(o);
            }

            var field = contract.restrict(infield);

            if (field != null && field.bind) {
                o[fieldName] = field.bind(o);
            } else {
                o[fieldName] = field;
            }

            function buildGettersAndSetters(contract, fieldName) {
                x.__defineGetter__(fieldName, function() {
                        return o[fieldName];
                        });
                x.__defineSetter__(fieldName, function(value) {
                        o[fieldName] = contract.restrict(value);
                        });
            }
            buildGettersAndSetters(contract, fieldName);

        }
        o.__proto__ = new Object();
        if (name) {
            o.__proto__.constructor = name;
        }

        x.__reference__ = function (contract, key) {
            if (key != contract.lock) {
                this.fail();
            } else {
                return o;
            }
        };

        return x;
    }

    this.relax = function(x) {
        if (!is('Object', x)) { this.fail(); }
        if (this.name && x.__proto__.constructor.name != this.name) { this.fail(); }
        if (x.__reference__) {
            var o = x.__reference__(this, this.lock);
            for (var i = 0; i < this.fields.length; i++) {
                var fieldName = this.fields[i].name;
                var contract = this.fields[i].contract(label);
                var infield = o[fieldName];

                if (infield != null && infield.bind) {
                    infield = infield.bind(o);
                }

                // Remove getters and setters for that field
                delete x[fieldName];

                var field = contract.relax(infield);

                // Copy fields back across
                if (field != null && field.bind) {
                    x[fieldName] = field.bind(x);
                } else {
                    x[fieldName] = field;
                }

                // Remove reference
                delete x.__reference__;
            }
        } else {
            // Relaxing without being restricted previously
            var o = new Object();
            for (var i = 0; i < this.fields.length; i++) {
                var fieldName = this.fields[i].name;
                var contract = this.fields[i].contract(label);
                var infield = x[fieldName];

                if (infield != null && infield.bind) {
                    infield = infield.bind(o);
                }

                var field = contract.relax(infield);
                if (field != null && field.bind) {
                    o[fieldName] = field.bind(o);
                } else {
                    o[fieldName] = field;
                }
            }
        }

        return x;
    }
}

ObjectContract.__proto__ = Contract.prototype;

function ObjectContractFactory(name, fields) {
    var f = function(label) {
        return new ObjectContract(label, name, fields);
    }
    f.repr = function() {
        var s = "[ "
        fields.forEach(function(field) {
            s += "{ name: \"" + field.name + "\", " + "contract: " + field.contract.repr() + " }, ";
        })
        s = s.substring(0, s.length - 2)

        return "ObjectContractFactory(" + name + ", " + s + " ])";
    }

    // Need to maintain these in the ObjectContractFactory to allow
    // ObjectContractFactoryMerge to function.
    f.name = name;
    f.fields = fields;
    return f;
}

// Merges two object contract factories. Currently only uses the name of the first
// if it is present and ignores the name of the second. Fields are merged together.
function ObjectContractFactoryMerge(a, b) {
    return new ObjectContractFactory(a.name, a.fields.concat(b.fields));
}

function MaybeContract(label, inner) {
    Contract.bind(this)(label);

    this.restrict = function(value) {
        // Supports both undefined and null. ie. null == null and undefined == null.
        if (value == null) {
            return value;
        }
        return inner.restrict(value);
    }

    this.relax = function (value) {
        if (value == null) {
            return value;
        }
        return inner.relax(value);
    }
}

MaybeContract.prototype.__proto__ = Contract.prototype;

function MaybeContractFactory(innerFactory) {
    var f = function(label) {
        return new MaybeContract(label, innerFactory(label));
    }
    f.repr = function() {return "MaybeContractFactory(" + innerFactory.repr() + ")"};
    return f;
}

function EmptyContract(label) {
    Contract.bind(this)(label);

    this.restrict = function(value) {
        // Functions are called with undefined when no arguments are provided.
        if (value !== undefined) {
            this.fail();
        }
    }

    this.relax = this.restrict;
}

EmptyContract.prototype.__proto__ = Contract.prototype;

function EmptyContractFactory() {
    var f = function(label) {
        return new EmptyContract(label);
    }
    f.repr = function() {return "EmptyContractFactory()"};
    return f;
}

function ADTContract(label, adtName, contracts) {
    Contract.bind(this)(label);
    var stringContract = StringContractFactory()(label);

    this.restrict = function(value) {
        stringContract.restrict(value.type);
        stringContract.restrict(value.cons);

        if (value.type !== adtName) {
            this.fail();
        }

        if (contracts[value.cons] == null) {
            this.fail();
        }

        return contracts[value.cons].restrict(value);
    }

    this.relax = function(value) {
        stringContract.relax(value.type);
        stringContract.relax(value.cons);

        if (value.type !== adtName) {
            this.fail();
        }

        if (contracts[value.cons] == null) {
            this.fail();
        }

        return contracts[value.cons].relax(value);
    }

}

ADTContract.prototype.__proto__ = Contract.prototype;

function ADTContractFactory(adtName, contracts) {
    var f = function(label) {
        // Cannot generate contracts any earlier as these contracts may contain
        // the ADT itself, so the ADT contract must be created first.
        var builtContracts = {};
        // Generating contracts from strings
        for (var c in contracts) {
            builtContracts[c] = buildContract(contracts[c])(label);
        }
        return new ADTContract(label, adtName, builtContracts);
    }
    f.repr = function() {return "ADTContractFactory(" + adtName + ")"};
    return f;
}

// Builds contracts by parsing string inputs.
function buildContract(input) {
    // Split input and keep brackets.
    input = input.split(/(\(|\)|->|\{|\}|\?|[a-zA-Z0-9]*)/);
    input = input.filter(function(s) { return s.trim() != '' });

    // Check for typedefs and replace with strings, recursively calls
    // build contract to check for more typedefs
    for (var i = 0; i < input.length; i++) {
        if (typedefs[input[i]]) {
            input[i] = typedefs[input[i]];
            return buildContract(input.join(" "));
        }
    }

    var pos = 0;

    function parse() {
        var result = undefined;

        function parseKeyVal() {
            var name = input[pos++];
            pos += 1;
            var val = parse();
            return {name: name, contract: val};
        }

        function parseHead() {
            if (input[pos] == "Int") {
                pos += 1;
                out = IntegerContractFactory();
            } else if (input[pos] == "Num") {
                pos += 1;
                out = NumberContractFactory();
            } else if (input[pos] == "String") {
                pos += 1;
                out = StringContractFactory();
            } else if (input[pos] == "Bool") {
                pos += 1;
                out = BooleanContractFactory();
            } else if (input[pos] == "Unit") {
                pos += 1;
                out = UnitContractFactory();
            } else if (input[pos] == "0") {
                pos += 1;
                out = EmptyContractFactory();
                pos += 1; // ->
                range = parse();
                out = FunctionContractFactory(EmptyContractFactory(), range);
            } else if (input[pos] == "(") {
                pos += 1;
                out = parse();
            } else if (input[pos] == "[") {
                pos += 1;
                var inner = parse();
                out = ListContractFactory(inner);
            } else if (input[pos] == "<") {
                pos += 1;
                var key = StringContractFactory();
                var value = parse();
                out = MapContractFactory(key, value);
            } else if (input[pos] == "{") {
                // Parses and returns one ObjectContractFactory
                var parseObject = function () {
                    var record = [];
                    // Allow empty record contract
                    if (input[pos+1] != "}") {
                        while (input[pos] != "}") {
                            pos += 1;
                            record.push(parseKeyVal());
                        }
                    }
                    pos += 1;
                    var name = undefined;
                    if (input[pos] == "@") {
                        pos += 1;
                        name = input[pos];
                        pos += 1;
                    }
                    return ObjectContractFactory(name, record);
                }
                out = parseObject();
                // Checks for union operator and performs a merge operation if
                // present and does so until there are no more merges necessary.
                while (input[pos] == "U" && input[pos+1] == "{") {
                    pos += 1;
                    out = ObjectContractFactoryMerge(out, parseObject());
                }
            } else if (input[pos] == "forall") {
                pos += 1;
                var vars = [];
                while (input[pos] != ".") {
                    vars.push(input[pos]);
                    pos += 1;
                }
                pos += 1;
                var out = parseHead();
                // Inserting a forall for each variable.
                vars.reverse().forEach(function(v) {
                    var typeFunc = "function(" + v + ") { return " + out.repr() + "}"
                    var typeFunc = eval("typeFunc = " + typeFunc);
                    out = ForAllContractFactory(typeFunc);
                });
                return out;
            } else if (adts[input[pos]] != null) {
                out = adts[input[pos++]];
            } else {
                out = VariableContractFactoryPlaceholder(input[pos]);
                pos += 1;
            }

            if (input[pos] == "?") {
                pos += 1;
                out =  MaybeContractFactory(out);
            }

            if (input[pos] == "->") {
                pos += 1;
                var range = parseHead();
                return FunctionContractFactory(out, range);
            }

            return out;
        }

        while (pos < input.length) {
            if (input[pos] == ")" || input[pos] == "]" || input[pos] == ">") {
                pos += 1;
                return result;
            }
            if (input[pos] == "," || input[pos] == "}") {
                return result;
            }
            result = parseHead();
        }
        return result;
    }

    return parse();

}

function T(spec, value) {
    // Checking if a typedef
    var input = spec.split(" ");
    if (input[0].trim() == "typedef") {
        var typedef = spec.substring(input[0].length).split("::");
        createTypedef(typedef[0].trim(), typedef[1].trim());
        return null;
    }

    var values = spec.split("::");

    var contract = buildContract(values[1].trim())(new Label(values[0].trim()));
    return contract.restrict(value);
}

// Stores all the typedefs that have been made
var typedefs = {};
var reserved = {Int: true, String: true, Bool: true, Num: true, Unit: true, 0: true, forall: true};
function createTypedef(label, typedef) {
    if (typedefs[label]) {
        // Preventing typedefs to be redefined.
        throw TypeError("Error creating typedef for " + label + " already exists");
    } else if (reserved[label]) {
        // Preventing reserved words from being used.
        throw TypeError("Error creating typedef for " + label + " - using reserved word");
    }
    // Store typedef
    typedefs[label] = typedef;
}

var adts = {};

// This function allows for Abstract algebraic data types to be created using a
// string representation.
function D(spec) {
    var values = spec.split("=");
    return buildADT(values[0].trim(), values[1]);
}

// BuildADT parses the string spec and calls createAdt with the parsed data.
function buildADT(adtName, input) {
    input = input.split(/( |(?=\|))/);
    input = input.filter(function(s) { return s.trim() != '' });

    // This function simply parses all the data constructors and returns them
    // as a list.
    function parse() {
        var pos = 0;
        var cons = [];
        while (pos < input.length) {
            var name = input[pos++];
            var params = [];
            while (input[pos] != "|" && pos < input.length) {
                params.push({type: input[pos], name: params.length});
                pos++;
                if (input[pos] == "as") {
                    pos++;
                    params[params.length - 1].name = input[pos];
                    pos++;
                }
            }
            if (input[pos] == "|") {
                pos++;
            }
            cons.push({name: name, params: params});
        }
        return cons;
    }

    return createADT(adtName, parse());
}

// Creates data constructors with contracts for the ADT. Also allows for data access
// and also allows for pattern matching to be performed against the ADT.
// Input cons is an array of constructors which have a name and a list of params as Strings.
// eg. a valid inputcons would be
// [{name: Empty, params: []},
//  {name: Leaf, params: [{type: Int, name: Leaf}]},
//  {name: Node, params: [{type: BTree, name: left}, {type: BTree, name: right}]}]
function createADT(adtName, inputCons) {
    var result = {};

    // The ADT contract is created with all the relevant data contracts.
    function createContract() {
        var contracts = {};
        for (var i in inputCons) {
            var cons = inputCons[i];

            // Creating contract
            var dataConsContract = "{";
            for (var i in cons.params) {
                dataConsContract += cons.params[i].name + ": " + cons.params[i].type;
                dataConsContract += i < cons.params.length - 1 ? ", " : "";
            }
            dataConsContract += "}";

            // Store contract
            contracts[cons.name] = dataConsContract;
        }
        // Create ADT contract
        adts[adtName] = ADTContractFactory(adtName, contracts);
    }

    // Constructors and their accommpanying contracts need to be created.
    function createCons(inputCons, cons) {
        // Builds up a contract for the data constructor.
        var consContract = cons.name + " :: ";
        if (cons.params.length == 0) {
            consContract += "0 -> ";
        } else {
            for (var i in cons.params) {
                consContract += cons.params[i].type + " -> ";
            }
        }
        consContract += adtName;

        // Creates the actual constructor with a contract.
        result[cons.name] = T(consContract, function () {
            var o = {};
            o.type = adtName;
            o.cons = cons.name;
            // Allows for data ccess
            for (var i in cons.params) {
                o[cons.params[i].name] = arguments[i];
            }
            // Creates functions to determine which data constructor was used.
            for (var i in inputCons) {
                var is = inputCons[i].name == cons.name;
                o["is" + inputCons[i].name] = inputCons[i].name == cons.name ?
                    function () { return true; } : function () { return false; };
            }
            return o;
        });
    }

    // Creates a pattern matching function.
    function createMatcher(inputCons) {
        // Perform actual pattern matching and return result.
        matcher = function (o) {
            for (var i in matcher.patterns) {
                if (matcher.patterns[i].checkMatch(o)) {
                    return matcher.patterns[i].callback();
                }
            }
            return undefined;
        }
        // Stores created patterns.
        matcher.patterns = [];

        // Create matching functions for each data constructor as well
        // as the default function.
        for (var i in inputCons) {
            var cons = inputCons[i];
            matcher[cons.name] = createMatcherWith(cons);
        }
        matcher["_"] = createMatcherWith();

        // Creates one matching function, which can check if the object
        // is a match as well as register the pattern to be used later.
        function createMatcherWith(cons) {
            return function() {
                var args = arguments;
                var checkMatch = function (o) {
                    // Check matching
                    if (cons === undefined) {
                        // Default value
                    } else if (o["is" + cons.name]()) {
                        for (var j in args) {
                            var a = args[j];
                            // Recursviely check that this is a match.
                            if (is('Function', a) && a.match) {
                                if (a.match(o[cons.params[j].name]) === false) {
                                    return false;
                                }
                            } else if (is('String', a) && a[0] != "'") {
                                // Variable, do nothing for now
                            } else {
                                if (is('String', a) && a[0] == "'") {
                                    // Literal string value
                                    if (a.substring(1) !== o[cons.params[j].name]) {
                                        return false;
                                    }
                                } else if (a !== o[cons.params[j].name]) {
                                    // Actual value
                                    return false;
                                }
                            }
                        }
                    } else {
                        return false;
                    }

                    // A match has been found, so we now need to assign
                    // properties specified by the variables given in the pattern.
                    for (var j in args) {
                        var a = args[j];
                        if (is('String', a) && a != "_" && a[0] != "'") {
                            if (cons === undefined) {
                                matcher[a] = o;
                            } else {
                                matcher[a] = o[cons.params[j].name];
                            }
                        }
                    }

                    return true;
                }
                // Register pattern when a callback is given.
                var f = function(fn) {
                    matcher.patterns.push({checkMatch: checkMatch, callback: fn});
                };
                f.match = checkMatch;
                return f;
            };
        }

        return matcher;
    }

    createContract();

    for (var i in inputCons) {
        createCons(inputCons, inputCons[i]);
    }

    result.matcher = function (fn, name) {
        // Allows for cached pattern matchers.
        name = (name === undefined) ? "_m" : name;
        if (fn !== undefined) {
            fn[name] = (fn[name] === undefined) ? createMatcher(inputCons) : fn[name];
            return fn[name];
        } else {
            return createMatcher(inputCons);
        }
    };
    return result;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.T = T;
    module.exports.D = D;
} else {
    window.Contract = {
        T: T,
        D: D,
        Internal: {
            IntegerContractFactory: IntegerContractFactory,
            NumberContractFactory: NumberContractFactory,
            StringContractFactory: StringContractFactory,
            BooleanContractFactory: BooleanContractFactory,
            UnitContractFactory: UnitContractFactory,
            ListContractFactory: ListContractFactory,
            MapContractFactory: MapContractFactory,
            ForAllContractFactory: ForAllContractFactory,
            VariableContractFactory: VariableContractFactory,
            FunctionContractFactory: FunctionContractFactory,
            ObjectContractFactory: ObjectContractFactory,
            MaybeContractFactory: MaybeContractFactory,
            EmptyContractFactory: EmptyContractFactory,
            ObjectContractFactoryMerge: ObjectContractFactoryMerge,
            createTypedef: createTypedef,
            createADT: createADT
        }
    }
}
}());
