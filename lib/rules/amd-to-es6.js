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
            CallExpression(rootCallNode) {
                const src = context.getSourceCode();

                const functionName = (
                    rootCallNode.callee && 
                    rootCallNode.callee.name
                );
                const callbackNode = rootCallNode.arguments.find(arg => 
                    arg.type == "FunctionExpression" ||
                    arg.type == "ArrowFunctionExpression"
                );

                const isRootCall = (
                    rootCallNode.parent && (
                        rootCallNode.parent.type == "Program"
                        || 
                        rootCallNode.parent.type == "ExpressionStatement" && 
                        rootCallNode.parent.parent && 
                        rootCallNode.parent.parent.type == "Program"
                    )
                );

                const isAmd = (
                    functionName == "define" && 
                    isRootCall
                );

                if ( isAmd ) {

                    if ( !callbackNode ) {
                        context.report({
                            node: rootCallNode,
                            messageId: "amdArgumentsShouldBeVariables"
                        });
                        return;
                    }

                    let imports;

                    try {
                        imports = generateImports(src, rootCallNode, callbackNode);
                    } catch (err) {
                        if ( err.message == "import name should be variable" ) {
                            context.report({
                                node: rootCallNode,
                                messageId: "amdArgumentsShouldBeVariables"
                            });
                            return;
                        }
                        if ( err.message == "import paths should be string" ) {
                            context.report({
                                node: rootCallNode,
                                messageId: "amdPathsShouldBeStrings"
                            });
                            return;
                        }
                        
                        throw err;
                    }

                    context.report({
                        node: rootCallNode,
                        messageId: "amdNotAllowed",
                        fix(fixer) {
                            let callbackBodyStart = callbackNode.body.start;
                            let callbackBodyText = src.getText(callbackNode.body) || "";
                            if ( callbackBodyText[0] == "{" ) {
                                callbackBodyStart++;
                                callbackBodyText = callbackBodyText.slice(1);
                            }
                            if ( callbackBodyText.slice(-1) == "}" ) {
                                callbackBodyText = callbackBodyText.slice(0, -1);
                            }

                            // replace reutrn statement to export default
                            const callbackBodyNodes = (
                                callbackNode.body && callbackNode.body.length &&
                                callbackNode.body
                                ||
                                callbackNode.body &&
                                callbackNode.body.body &&
                                callbackNode.body.body.length &&
                                callbackNode.body.body
                            );
                            if ( callbackBodyNodes ) {
                                const returnNodeIndex = callbackBodyNodes.findIndex(node =>
                                    node.type == "ReturnStatement"
                                );
                                const returnNode = callbackBodyNodes[returnNodeIndex];

                                if ( returnNode ) {
                                    const returnNodeText = src.getText(returnNode);
                                    const exportDefaultText = returnNodeText
                                        .replace(/^\s*return\s+/, "export default ");
                                    
                                    const start = returnNode.start - callbackBodyStart;
                                    const end = returnNode.end - callbackBodyStart;

                                    callbackBodyText = (
                                        callbackBodyText.slice(0, start) +
                                        exportDefaultText + 
                                        callbackBodyText.slice(end)
                                    );
                                }
                            }

                            // removing "use strict"; inside function body
                            const useStrictNode = callbackBodyNodes && callbackBodyNodes.find(node =>
                                node.type == "ExpressionStatement" &&
                                node.directive == "use strict"
                            );
                            if ( useStrictNode ) {
                                const start = useStrictNode.start - callbackBodyStart;
                                const end = useStrictNode.end - callbackBodyStart;

                                callbackBodyText = (
                                    callbackBodyText.slice(0, start) +
                                    callbackBodyText.slice(end)
                                );
                            }
                            
                            const rootCallNodeSrcCode = src.getText(rootCallNode);
                            const parentNodeSrcCode = src.getText(rootCallNode.parent);

                            // fix excess ;
                            if ( parentNodeSrcCode == rootCallNodeSrcCode + ";" ) {
                                return fixer.replaceText(rootCallNode.parent, imports + callbackBodyText);
                            }
                            else {
                                return fixer.replaceText(rootCallNode, imports + callbackBodyText);
                            }
                            
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

            if ( importName && !importNameIsJustVariable ) {
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

            if ( importPathSrc[0] == "'" ) {
                importPathSrc = importPathSrc.slice(1, -1);
                importPathSrc = "\"" + importPathSrc + "\"";
            }
            
            let importSrc;
            if ( importName ) {
                const importNameSrc = src.getText(importName);
                importSrc = `import ${importNameSrc} from ${ importPathSrc };\n`;
            }
            else {
                importSrc = `import ${ importPathSrc };\n`;
            }

            imports.push(importSrc);
        });
    }

    return imports.join("");
}