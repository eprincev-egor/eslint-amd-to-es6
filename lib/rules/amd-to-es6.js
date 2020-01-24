"use strict";

module.exports = {
    meta: {
        docs: {
            description: "Control space in for statement."
        },
        schema: [{
            enum: ["always", "never"]
        }],
        fixable: "code",
        messages: {
            amdNotAllowed: "AMD style is not allowed, please use es6 syntax import/export",
            amdArgumentsShouldBeVariables: 
                "AMD style is not allowed, " +
                "and impossible convert to es6 because arguments should be just variables",
            amdPathsShouldBeStrings: 
                "AMD style is not allowed, " +
                "and impossible convert to es6 because paths should be just strings"
        }
    },
    create(context) {
        return {
            CallExpression(node) {
                const src = context.getSourceCode();

                const functionName = (
                    node.callee 
                    && node.callee.name
                );
                const callbackNode = node.arguments.find(arg => 
                    arg.type == "FunctionExpression" ||
                    arg.type == "ArrowFunctionExpression"
                );

                const isRootCall = (
                    node.parent && (
                        node.parent.type == "Program"
                        || 
                        node.parent.type == "ExpressionStatement" && 
                        node.parent.parent && 
                        node.parent.parent.type == "Program"
                    )
                );

                const isAmd = (
                    functionName == "define" && 
                    isRootCall
                );

                if ( isAmd ) {

                    if ( !callbackNode ) {
                        context.report({
                            node,
                            messageId: "amdArgumentsShouldBeVariables"
                        });
                        return;
                    }

                    const callbackBodyNode = (
                        callbackNode.body &&
                        callbackNode.body.body &&
                        callbackNode.body.body[0]
                    );
    
                    const callbackBodyText = src.getText(callbackBodyNode) || "";
                    let imports;

                    try {
                        imports = generateImports(src, node, callbackNode);
                    } catch (err) {
                        if ( err.message == "import name should be variable" ) {
                            context.report({
                                node,
                                messageId: "amdArgumentsShouldBeVariables"
                            });
                            return;
                        }
                        if ( err.message == "import paths should be string" ) {
                            context.report({
                                node,
                                messageId: "amdPathsShouldBeStrings"
                            });
                            return;
                        }
                        
                        throw err;
                    }

                    context.report({
                        node,
                        messageId: "amdNotAllowed",
                        fix(fixer) {
                            return fixer.replaceText(node, imports + callbackBodyText);
                        }
                    });
                }
            }
        };
    }
};

function generateImports(src, amdCallNode, callbackNode) {
    let imports = [];
    const amdArgs = amdCallNode.arguments || [];
    const fistArg = amdArgs[0];
    const fistArgIsArray = (
        fistArg &&
        fistArg.type == "ArrayExpression"
    );

    if ( fistArgIsArray ) {
        const arr = fistArg.elements || [];
        
        arr.forEach((arg, i) => {
            const importName = (
                callbackNode.params &&
                callbackNode.params[i]
            );
            const importNameIsJustVariable = (
                importName &&
                importName.type == "Identifier"
            );

            if ( !importNameIsJustVariable ) {
                throw new Error("import name should be variable");
            }

            const importPathIsString = (
                arg.type == "Literal" &&
                (arg.raw[0] == "\"" ||
                arg.raw[0] == "'")
            );

            if ( !importPathIsString ) {
                throw new Error("import paths should be string");
            }

            let importPathSrc = src.getText(arg);
            const importNameSrc = src.getText(importName);

            if ( importPathSrc[0] == "'" ) {
                importPathSrc = importPathSrc.slice(1, -1);
                importPathSrc = "\"" + importPathSrc + "\"";
            }
            
            const importSrc = `import ${importNameSrc} from ${ importPathSrc };\n`;

            imports.push(importSrc);
        });
    }

    return imports.join("");
}