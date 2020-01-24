"use strict";

let rule = require("../../../lib/rules/amd-to-es6");
let RuleTester = require("eslint").RuleTester;

let ruleTester = new RuleTester({ 
    parserOptions: { 
        ecmaVersion: 2018, 
        sourceType: "module" 
    } 
});

ruleTester.run("amd-to-es6", rule, {

    valid: [
        {
            code: "import x from \"x\""
        },
        {
            code: "console.log('nice')"
        },
        {
            code: "export default class {}"
        }
    ],

    invalid: [
        {
            code: `define([
                "funcs",
                "css!some/style.css"
            ], (f) => {})`,
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: [
                "import f from \"funcs\";\n",
                "import \"css!some/style.css\";\n"
            ].join("")
        },
        {
            code: `define(["Some"], function(Some) {${[
                "var x = 1;",
                "return Some(x);"
            ].join("\n")}})`,
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: [
                "import Some from \"Some\";\n",
                "var x = 1;\n",
                "export default Some(x);"
            ].join("")
        },
        {
            code: "define(['x' + 1], function(x) {})",
            errors: [
                { messageId: "amdPathsShouldBeStrings" }
            ]
        },
        {
            code: "define(['x'], function({n}) {})",
            errors: [
                { messageId: "amdArgumentsShouldBeVariables" }
            ]
        },
        {
            code: `define([
                'funcs',
                'Rows'
            ], function(f, Rows) {f.some(Rows);})`,
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: [
                "import f from \"funcs\";\n",
                "import Rows from \"Rows\";\n",
                "f.some(Rows);"
            ].join("")
        },
        {
            code: `define([
                "funcs"
            ], function(f) {f.nice();})`,
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: [
                "import f from \"funcs\";\n",
                "f.nice();"
            ].join("")
        },
        {
            code: "define([], function() {console.log(\"test\");})",
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: "console.log(\"test\");"
        },
        {
            code: "define([], () => {console.log(\"test\");})",
            errors: [
                { messageId: "amdNotAllowed" }
            ],
            output: "console.log(\"test\");"
        },
        {
            code: "define(['x'])",
            errors: [
                { messageId: "amdArgumentsShouldBeVariables" }
            ]
        }
    ]
});
