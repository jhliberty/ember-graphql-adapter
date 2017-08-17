import * as Type from 'ember-graphql-adapter/types';
import Ember from 'ember';

class Parser {
  constructor({normalizeCaseFn, parseSelectionSet}) {
    this.agenda = [];
    this.normalizeCaseFn = normalizeCaseFn;
    this.parseSelectionSet = parseSelectionSet;
    this.visited = [];
  }

  parse(model, store, operation, rootField) {
    if (this.parseSelectionSet) {
      this.agenda.push({ name: model.modelName, model, field: rootField });

      while (this.agenda.length > 0) {
        let current = this.agenda.shift();
        this.visited.push(current.name);

        let currentModel = current.model;
        let currentField = current.field;

        currentField.selectionSet.push(new Type.Field(`${current.name}_id`));

        /*jshint loopfunc: true */
        currentModel.eachAttribute((attr) => {
          let field = this._buildField(attr);
          currentField.selectionSet.push(field);
        });

        currentModel.eachRelationship((relName, relationship) => {
          let field;
          let { type, options } = relationship;

          if (options.async) {
            field = this._buildAsyncRelationship(relName, relationship);
          } else {
            let relModel = store.modelFor(type);
            if (this.visited.indexOf(relName) === -1) {
              field = new Type.Field(
                this.normalizeCaseFn(relName),
                null,
                new Type.ArgumentSet(),
                new Type.SelectionSet()
              );
              this.agenda.push({ name: relName, model: relModel, field });
            }
          }
          if (field) {
            currentField.selectionSet.push(field);
          }
        });
      }
    } else {
      rootField.selectionSet.push(new Type.Field('id'));
    }

    operation.selectionSet.push(rootField);

    return operation;
  }

  _buildField(attr) {
    return new Type.Field(this.normalizeCaseFn(attr));
  }

  _buildAsyncRelationship(relName, { kind }) {
    let suffix = kind === 'hasMany' ? 'Ids' : 'Id';
    return this._buildField(Ember.String.singularize(relName) + suffix);
  }
}

export default {
  parse(model, store, operation, rootField, options) {
    let parser = new Parser(options);

    return parser.parse(model, store, operation, rootField);
  }
};
