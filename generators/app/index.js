'use strict';
var path = require('path'),
    util = require('util'),
    yeoman = require('yeoman-generator'),
    chalk = require('chalk'),
    _ = require('lodash'),
    pluralize = require('pluralize'),
    packagejs = require(__dirname + '/../../package.json'),
    fs = require('fs'),
    semver = require('semver'),
    glob = require("glob");

// Stores JHipster variables
var jhipsterVar = {moduleName: 'entity-audit'};

// Stores JHipster functions
var jhipsterFunc = {};

var STRIP_HTML = 'stripHtml',
    STRIP_JS = 'stripJs',
    COPY = 'copy',
    TPL = 'template';

const SERVER_MAIN_SRC_DIR = 'src/main/java/';
const JHIPSTER_USER_TABLE_NAME = 'jhi_user';
const INTERPOLATE_REGEX = '/<%:([\s\S]+?)%>/g'; // so that tags in templates do not get mistreated as _ templates

module.exports = yeoman.Base.extend({

  initializing: {
    compose: function (args) {
      this.composeWith('jhipster:modules', {
        options: {
          jhipsterVar: jhipsterVar,
          jhipsterFunc: jhipsterFunc
        }
      });

      if (args == 'default') {
        this.defaultAudit = true;
      }
      if (args === 'javers') {
        this.javersAudit = true;
      }
    },

    displayLogo: function () {
      this.log(chalk.white('Welcome to the ' + chalk.bold('JHipster Entity Audit and Default delete behavior') + ' Generator! ' + chalk.yellow('v' + packagejs.version + '\n')));
    },

    checkJHVersion: function () {
      var supportedJHVersion = packagejs.dependencies['generator-jhipster'];
      if (jhipsterVar.jhipsterVersion && !semver.satisfies(jhipsterVar.jhipsterVersion, supportedJHVersion)) {
        this.env.error(chalk.red.bold('ERROR!') + ' I support only JHipster versions greater than ${supportedJHVersion}... If you want to use Entity Audit with an older JHipster version, download a previous version that supports the required JHipster version.');
      }
    },

    checkDBType: function () {
      if (jhipsterVar.databaseType != 'sql' && jhipsterVar.databaseType != 'mongodb') {
        this.env.error(chalk.red.bold('ERROR!') + ' I support only SQL or MongoDB databases...\n');
      }
    },

    getEntitityNames: function () {
      var existingEntities = [],
      existingEntityChoices = [],
      existingEntityNames = [];
      try{
        existingEntityNames = fs.readdirSync('.jhipster');
      } catch(e) {
        this.log(chalk.red.bold('ERROR!') + ' Could not read entities, you might not have generated any entities yet. I will continue to install audit files, entities will not be updated...\n');
      }

      existingEntityNames.forEach(function(entry) {
        if(entry.indexOf('.json') !== -1){
          var entityName = entry.replace('.json','');
          existingEntities.push(entityName);
          existingEntityChoices.push({name: entityName, value: entityName});
        }
      });
      this.existingEntities = existingEntities;
      this.existingEntityChoices = existingEntityChoices;
    }
  },

  prompting: function () {
    var done = this.async();
    var prompts = [
      {
        type: 'list',
        name: 'auditFramework',
        message: 'Choose which audit framework you would like to use.',
        choices: [
          {name: 'Custom JHipster auditing (works with SQL)', value: 'custom'},
          {name: '[BETA] Javers auditing framework (works with SQL and MongoDB)', value: 'javers'}
        ],
        default: 'custom'
      },
      {
        type: 'list',
        name: 'updateType',
        message: 'Do you want to enable audit for all existing entities?',
        choices: [
          {name: 'Yes, update all', value: 'all'},
          {name: 'No, let me choose the entities to update', value: 'selected'}
        ],
        default: 'all'
      },
      {
        when: function (response) {
          return response.updateType != 'all';
        },
        type: 'checkbox',
        name: 'entitiesToUpdate',
        message: 'Please choose the entities to be audited',
        choices: this.existingEntityChoices,
        default: 'none'
      },{
        type: 'confirm',
        name: 'auditPage',
        message: 'Do you want to add an audit log page for entities?',
        default: true
      },
      {
        type: 'list',
        name: 'changeDeleteBehavior',
        message: 'Do you want to change default delete behavior for generated entities?',
        choices: [
          {name: 'Yes, update all', value: 'deleteForAll'},
          {name: 'No, let me choose the entities to update', value: 'deleteForSelected'}
        ],
        default: 'deleteForAll'
      }
    ];

    if (this.defaultAudit) {
      this.auditFramework = 'custom'
      this.updateType = 'all';
      this.auditPage = true;
      this.changeDeleteBehavior = 'deleteForAll';
      done();
    } else if(this.javersAudit) {
      this.auditFramework = 'javers'
      this.updateType = 'all';
      this.auditPage = true;
      this.changeDeleteBehavior = 'deleteForAll';
      done();
    } else {
      this.prompt(prompts, function (props) {

        // Check if an invalid database, auditFramework is selected
        if (props.auditFramework === 'custom' && jhipsterVar.databaseType === 'mongodb') {
          this.env.error(chalk.red.bold('ERROR!') + ' The JHipster audit framework supports SQL databases only...\n');
        } else if (props.auditFramework === 'javers' && jhipsterVar.databaseType != 'sql' && jhipsterVar.databaseType != 'mongodb'){
          this.env.error(chalk.red.bold('ERROR!') + ' The Javers audit framework supports only SQL or MongoDB databases...\n');
        }

        this.props = props;
        // To access props later use this.props.someOption;
        this.auditFramework = props.auditFramework;
        this.updateType = props.updateType;
        this.auditPage = props.auditPage;
        this.entitiesToUpdate = props.entitiesToUpdate;
        this.changeDeleteBehavior = props.changeDeleteBehavior;
        done();
      }.bind(this));
    }
  },

  writing: {
    updateYeomanConfig : function() {
      this.config.set('auditFramework', this.auditFramework);
      this.config.set('changeDeleteBehavior', this.changeDeleteBehavior);
    },

    setupGlobalVar : function () {
      this.baseName = jhipsterVar.baseName;
      this.packageName = jhipsterVar.packageName;
      this.angularAppName = jhipsterVar.angularAppName;
      this.frontendBuilder = jhipsterVar.frontendBuilder;
      this.buildTool = jhipsterVar.buildTool;
      this.databaseType = jhipsterVar.databaseType;
      this.devDatabaseType = jhipsterVar.devDatabaseType;
      this.prodDatabaseType = jhipsterVar.prodDatabaseType;
      this.enableTranslation = jhipsterVar.enableTranslation;
      this.changelogDate = jhipsterFunc.dateFormatForLiquibase();
      this.searchEngine = jhipsterVar.searchEngine;
      this.webappDir = jhipsterVar.webappDir;
      this.javaTemplateDir = 'src/main/java/package';
      this.resourcesTemplateDir = 'src/main/resources';
      this.javaDir = jhipsterVar.javaDir;
      this.resourceDir = jhipsterVar.resourceDir;
      this.interpolateRegex = /<%=([\s\S]+?)%>/g; // so that thymeleaf tags in templates do not get mistreated as _ templates
      this.jhipsterConfigDirectory = '.jhipster';
      this.copyFiles = function (files) {
        files.forEach( function(file) {
          jhipsterFunc.copyTemplate(file.from, file.to, file.type? file.type: TPL, this, file.interpolate? { 'interpolate': file.interpolate } : undefined);
        }, this);
      };
    },

    writeBaseFiles : function () {

      if (this.changeDeleteBehavior = 'deleteForAll'){
          // collect files to copy
          var files = [
            {
              from: this.javaTemplateDir + '/domain/_AbstractAuditingEntity.java',
              to: this.javaDir + 'domain/AbstractAuditingEntity.java'
            }
          ];
          this.copyFiles(files);
      }

      if (this.auditFramework === 'custom') {
        // collect files to copy
        var files = [{ from: this.javaTemplateDir + '/config/audit/_AsyncEntityAuditEventWriter.java', to: this.javaDir + 'config/audit/AsyncEntityAuditEventWriter.java'},
            { from: this.javaTemplateDir + '/config/audit/_EntityAuditEventListener.java', to: this.javaDir + 'config/audit/EntityAuditEventListener.java'},
            { from: this.javaTemplateDir + '/config/audit/_EntityAuditAction.java', to: this.javaDir + 'config/audit/EntityAuditAction.java'},
            { from: this.javaTemplateDir + '/config/audit/_EntityAuditEventConfig.java', to: this.javaDir + 'config/audit/EntityAuditEventConfig.java'},
            { from: this.javaTemplateDir + '/domain/_EntityAuditEvent.java', to: this.javaDir + 'domain/EntityAuditEvent.java'},
            { from: this.javaTemplateDir + '/repository/_EntityAuditEventRepository.java', to: this.javaDir + 'repository/EntityAuditEventRepository.java'},
            { from: this.javaTemplateDir + '/service/dto/_AbstractAuditingDTO.java', to: this.javaDir + 'service/dto/AbstractAuditingDTO.java'},
            { from: this.resourceDir + '/config/liquibase/changelog/_EntityAuditEvent.xml',
              to: this.resourceDir + 'config/liquibase/changelog/' + this.changelogDate + '_added_entity_EntityAuditEvent.xml', interpolate: this.interpolateRegex }
          ];
        this.copyFiles(files);
        jhipsterFunc.addChangelogToLiquibase(this.changelogDate + '_added_entity_EntityAuditEvent');

        // add the new Listener to the 'AbstractAuditingEntity' class and add import
        if(!this.fs.read(this.javaDir + 'domain/AbstractAuditingEntity.java', {defaults: ''}).includes('EntityAuditEventListener.class')) {
          jhipsterFunc.replaceContent(this.javaDir + 'domain/AbstractAuditingEntity.java', 'AuditingEntityListener.class', '{AuditingEntityListener.class, EntityAuditEventListener.class}');
          jhipsterFunc.rewriteFile(this.javaDir + 'domain/AbstractAuditingEntity.java',
            'import org.springframework.data.jpa.domain.support.AuditingEntityListener',
            'import ' + this.packageName + '.config.audit.EntityAuditEventListener;');
        }
        // remove the jsonIgnore on the audit fields so that the values can be passed
        jhipsterFunc.replaceContent(this.javaDir + 'domain/AbstractAuditingEntity.java', '\s*@JsonIgnore', '', true);

      } else {

        var files = [
          { from: this.javaTemplateDir + '/config/audit/_JaversAuthorProvider.java', to: this.javaDir + 'config/audit/JaversAuthorProvider.java'},
          { from: this.javaTemplateDir + '/config/audit/_EntityAuditAction.java', to: this.javaDir + 'config/audit/EntityAuditAction.java'},
          { from: this.javaTemplateDir + '/domain/_EntityAuditEvent.java', to: this.javaDir + 'domain/EntityAuditEvent.java'}
        ];

        this.copyFiles(files);
        //add required third party dependencies
        if (this.buildTool === 'maven') {

          if (this.databaseType === 'mongodb') {
             jhipsterFunc.addMavenDependency('org.javers', 'javers-spring-boot-starter-mongo', '2.0.0', '<scope>compile</scope>');
             jhipsterFunc.addMavenDependency('org.mongodb', 'mongo-java-driver', '3.2.2', '<scope>compile</scope>');
          } else if (this.databaseType === 'sql') {
             jhipsterFunc.addMavenDependency('org.javers', 'javers-spring-boot-starter-sql', '2.0.0', '<scope>compile</scope>');
          }

        } else if (this.buildTool === 'gradle') {

          if (this.databaseType === 'mongodb') {
            jhipsterFunc.addGradleDependency('compile', 'org.javers', 'javers-spring-boot-starter-mongo', '2.0.0');
            jhipsterFunc.addGradleDependency('compile', 'org.mongodb', 'mongo-java-driver', '3.2.2');
          } else if (this.databaseType === 'sql') {
            jhipsterFunc.addGradleDependency('compile', 'org.javers', 'javers-spring-boot-starter-sql', '2.0.0');
          }

        }
      }
    },

    updateEntityFiles : function () {
      // Update existing entities to enable audit
      if (this.updateType == 'all') {
        this.entitiesToUpdate = this.existingEntities;
      }
      if (this.entitiesToUpdate && this.entitiesToUpdate.length > 0 && this.entitiesToUpdate != 'none') {
        this.log('\n' + chalk.bold.green('I\'m Updating selected entities ') + chalk.bold.yellow(this.entitiesToUpdate));
        this.log('\n' + chalk.bold.yellow('Make sure these classes does not extend any other class to avoid any errors during compilation.'));
        var jsonObj = null;
        this.auditedEntities = [];

        this.entitiesToUpdate.forEach(function(entityName) {
          this.auditedEntities.push("\"" + entityName + "\"")
          //If want to change delete behavior
          if (this.changeDeleteBehavior = 'deleteForAll'){
            //We read configuration from file
            var fileName = this.jhipsterConfigDirectory + '/' + entityName + ".json";
            this.log(chalk.red.bold('WARN!') + " Var Service: " + fileName);
            this.fileData = this.fs.readJSON(fileName);
            //Config Entity data
            this.dto = this.fileData.dto;
            if (this.dto != undefined) {
              this.log(chalk.red.bold('WARN!') + ' dto is missing in .jhipster/${ this.name }.json, using no as fallback\n');
              this.dto = 'no';
            }
            this.entityNameCapitalized = _.upperFirst(entityName);
            this.entityClass = this.entityNameCapitalized;
            this.entityInstance = _.lowerFirst(entityName);
            this.entityClassPlural = pluralize(entityName);
            this.pagination = this.fileData.pagination;
            this.entityInstancePlural = pluralize(this.entityInstance);
            this.relationships = this.fileData.relationships;
            if (this.databaseType === 'cassandra' || this.databaseType === 'mongodb') {
              this.pkType = 'String';
            } else {
              this.pkType = 'Long';
            }
            //load relationship
            this.fieldsContainOwnerManyToMany = false;
            this.fieldsContainNoOwnerOneToOne = false;
            this.fieldsContainOwnerOneToOne = false;
            this.fieldsContainOneToMany = false;
            this.fieldsContainManyToOne = false;
            this.differentTypes = [this.entityClass];
            if (!this.relationships) {
              this.relationships = [];
            }
            this.relationships && this.relationships.forEach( function (relationship) {
              if (_.isUndefined(relationship.relationshipNameCapitalized)) {
                relationship.relationshipNameCapitalized = _.upperFirst(relationship.relationshipName);
              }

              if (_.isUndefined(relationship.relationshipNameCapitalizedPlural)) {
                if (relationship.relationshipName.length > 1) {
                  relationship.relationshipNameCapitalizedPlural = pluralize(_.upperFirst(relationship.relationshipName));
                } else {
                  relationship.relationshipNameCapitalizedPlural = _.upperFirst(pluralize(relationship.relationshipName));
                }
              }

              if (_.isUndefined(relationship.relationshipNameHumanized)) {
                relationship.relationshipNameHumanized = _.startCase(relationship.relationshipName);
              }

              if (_.isUndefined(relationship.relationshipNamePlural)) {
                relationship.relationshipNamePlural = pluralize(relationship.relationshipName);
              }

              if (_.isUndefined(relationship.relationshipFieldName)) {
                relationship.relationshipFieldName = _.lowerFirst(relationship.relationshipName);
              }

              if (_.isUndefined(relationship.relationshipFieldNamePlural)) {
                relationship.relationshipFieldNamePlural = pluralize(_.lowerFirst(relationship.relationshipName));
              }

              if (_.isUndefined(relationship.otherEntityRelationshipNamePlural) && (relationship.relationshipType === 'one-to-many' || (relationship.relationshipType === 'many-to-many' && relationship.ownerSide === false) || (relationship.relationshipType === 'one-to-one' && relationship.otherEntityName.toLowerCase() !== 'user'))) {
                relationship.otherEntityRelationshipNamePlural = pluralize(relationship.otherEntityRelationshipName);
              }

              if (_.isUndefined(relationship.otherEntityRelationshipNameCapitalized)) {
                relationship.otherEntityRelationshipNameCapitalized = _.upperFirst(relationship.otherEntityRelationshipName);
              }

              if (_.isUndefined(relationship.otherEntityRelationshipNameCapitalizedPlural)) {
                relationship.otherEntityRelationshipNameCapitalizedPlural = pluralize(_.upperFirst(relationship.otherEntityRelationshipName));
              }

              if (_.isUndefined(relationship.otherEntityNamePlural)) {
                relationship.otherEntityNamePlural = pluralize(relationship.otherEntityName);
              }

              if (_.isUndefined(relationship.otherEntityNameCapitalized)) {
                relationship.otherEntityNameCapitalized = _.upperFirst(relationship.otherEntityName);
              }

              if (_.isUndefined(relationship.otherEntityNameCapitalizedPlural)) {
                relationship.otherEntityNameCapitalizedPlural = pluralize(_.upperFirst(relationship.otherEntityName));
              }

              if (_.isUndefined(relationship.otherEntityFieldCapitalized)) {
                relationship.otherEntityFieldCapitalized = _.upperFirst(relationship.otherEntityField);
              }

              if (_.isUndefined(relationship.otherEntityStateName)) {
                relationship.otherEntityStateName = _.trim(_.kebabCase(relationship.otherEntityName), '-') + this.entityAngularJSSuffix;
              }
              // Load in-memory data for root
              if (relationship.relationshipType === 'many-to-many' && relationship.ownerSide) {
                this.fieldsContainOwnerManyToMany = true;
              } else if (relationship.relationshipType === 'one-to-one' && !relationship.ownerSide) {
                this.fieldsContainNoOwnerOneToOne = true;
              } else if (relationship.relationshipType === 'one-to-one' && relationship.ownerSide) {
                this.fieldsContainOwnerOneToOne = true;
              } else if (relationship.relationshipType === 'one-to-many') {
                this.fieldsContainOneToMany = true;
              } else if (relationship.relationshipType === 'many-to-one') {
                this.fieldsContainManyToOne = true;
              }

              if (relationship.relationshipValidateRules && relationship.relationshipValidateRules.indexOf('required') !== -1) {
                relationship.relationshipValidate = relationship.relationshipRequired = this.validation = true;
              }

              var entityType = relationship.otherEntityNameCapitalized;
              if (this.differentTypes.indexOf(entityType) === -1) {
                this.differentTypes.push(entityType);
              }
            }, this);
            this.service = this.fileData.service;
            if (this.service === 'serviceImpl') {
              //Update Implementation file
              this.template(this.javaTemplateDir + '/service/_EntityService.java',
                                    this.javaDir + 'service/' + entityName + 'Service.java', this, {});
              this.template(this.javaTemplateDir + '/service/impl/_EntityServiceImpl.java',
                                    this.javaDir + 'service/impl/' + entityName + 'ServiceImpl.java', this, {});
            }
            //Update Repository
            this.template(this.javaTemplateDir + '/repository/_EntityRepository.ejs',
                          this.javaDir + 'repository/' + entityName + 'Repository.java', this, {});
            //update liquibase changeset
            var file = glob.sync(this.resourceDir + "/config/liquibase/changelog/*_added_entity_" + entityName + ".xml")[0];
            if(file) {
              var columns = "<column name=\"del_status\" type=\"boolean\" defaultValue=\"false\"/>\n";
              jhipsterFunc.addColumnToLiquibaseEntityChangeset(file, columns);
            }
            //create field "del_status" in user table because it extends from AbstractAuditingEntity
            var currentDate = jhipsterFunc.dateFormatForLiquibase();
            this.changelogDate = currentDate;
            this.userTableName = JHIPSTER_USER_TABLE_NAME;
            this.template(this.resourcesTemplateDir + '/config/liquibase/changelog/_Add_DelStatus_Column_To_User_Entity.xml',
                          this.resourceDir + 'config/liquibase/changelog/' + this.changelogDate + '_Add_DelStatus_Column_To_User_Entity.xml', this, {'interpolate': INTERPOLATE_REGEX});
          }
          if (this.auditFramework === 'custom') {
            // extend entity with AbstractAuditingEntity
            if(!this.fs.read(this.javaDir + 'domain/' + entityName + '.java', {defaults: ''}).includes('extends AbstractAuditingEntity')) {
              jhipsterFunc.replaceContent(this.javaDir + 'domain/' + entityName + '.java', 'public class ' + entityName, 'public class ' + entityName + ' extends AbstractAuditingEntity');
            }

            // extend DTO with AbstractAuditingDTO
            jsonObj = this.fs.readJSON('.jhipster/' + entityName + '.json')
            if(jsonObj.dto == 'mapstruct') {
              if(!this.fs.read(this.javaDir + 'service/dto/' + entityName + 'DTO.java', {defaults: ''}).includes('extends AbstractAuditingDTO')) {
                jhipsterFunc.replaceContent(this.javaDir + 'service/dto/' + entityName + 'DTO.java', 'public class ' + entityName + 'DTO', 'public class ' + entityName + 'DTO extends AbstractAuditingDTO');
              }
            }

            //update liquibase changeset
            var file = glob.sync(this.resourceDir + "/config/liquibase/changelog/*_added_entity_" + entityName + ".xml")[0];
            if(file) {
              var columns = "<column name=\"created_by\" type=\"varchar(50)\">\n" +
              "                <constraints nullable=\"false\"/>\n" +
              "            </column>\n" +
              "            <column name=\"created_date\" type=\"timestamp\" defaultValueDate=\"${now}\">\n" +
              "                <constraints nullable=\"false\"/>\n" +
              "            </column>\n" +
              "            <column name=\"last_modified_by\" type=\"varchar(50)\"/>\n" +
              "            <column name=\"last_modified_date\" type=\"timestamp\"/>\n";
              jhipsterFunc.addColumnToLiquibaseEntityChangeset(file, columns);
            }
          } else {

            // check if repositories are already annotated
            var auditTableAnnotation = '@JaversSpringDataAuditable';
            var pattern = new RegExp(auditTableAnnotation, 'g')
            var content = this.fs.read(this.javaDir + 'repository/' + entityName + 'Repository.java', 'utf8');

            if (!pattern.test(content)) {
              // add javers annotations to repository
              if(!this.fs.read(this.javaDir + 'repository/' + entityName + 'Repository.java', {defaults: ''}).includes('@JaversSpringDataAuditable')) {
                jhipsterFunc.replaceContent(this.javaDir + 'repository/' + entityName + 'Repository.java', 'public interface ' + entityName + 'Repository', '@JaversSpringDataAuditable\npublic interface ' + entityName + 'Repository');
                jhipsterFunc.replaceContent(this.javaDir + 'repository/' + entityName + 'Repository.java', 'domain.' + entityName + ';', 'domain.' + entityName + ';\nimport org.javers.spring.annotation.JaversSpringDataAuditable;');
              }
            }
          }

        }, this);
      }
    },

    writeAuditPageFiles : function () {
      // Create audit log page for entities
      if (this.auditPage) {
        var files = [
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audits.html', to: this.webappDir + 'app/admin/entity-audit/entity-audits.html'},
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audit.detail.html', to: this.webappDir + 'app/admin/entity-audit/entity-audit.detail.html'},
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audit.state.js', to: this.webappDir + 'app/admin/entity-audit/entity-audit.state.js'},
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audit.controller.js', to: this.webappDir + 'app/admin/entity-audit/entity-audit.controller.js'},
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audit.detail.controller.js', to: this.webappDir + 'app/admin/entity-audit/entity-audit.detail.controller.js'},
          { from: this.webappDir + 'app/admin/entity-audit/_entity-audit.service.js', to: this.webappDir + 'app/admin/entity-audit/entity-audit.service.js'}
        ];
        if (this.auditFramework === 'custom') {
          files.push(
            { from: this.javaTemplateDir + '/web/rest/_EntityAuditResource.java', to: this.javaDir + 'web/rest/EntityAuditResource.java'}
          );
        } else {
          files.push(
            { from: this.javaTemplateDir + '/web/rest/_JaversEntityAuditResource.java', to: this.javaDir + 'web/rest/JaversEntityAuditResource.java'}
          );
        }
        this.copyFiles(files);
        // add bower dependency required
        jhipsterFunc.addBowerDependency('angular-object-diff', '1.0.3');
        jhipsterFunc.addAngularJsModule('ds.objectDiff');
        // add new menu entry
        jhipsterFunc.addElementToAdminMenu('entity-audit', 'list-alt', this.enableTranslation);
        jhipsterFunc.addTranslationKeyToAllLanguages('entity-audit', 'Entity Audit', 'addAdminElementTranslationKey', this.enableTranslation);

      }

    },

    registering: function () {
      try {
        jhipsterFunc.registerModule("generator-jhipster-entity-audit", "entity", "post", "entity", "Add support for entity audit and audit log page");
      } catch (err) {
        this.log(chalk.red.bold('WARN!') + ' Could not register as a jhipster post entity creation hook...\n');
      }
    },
  },

  install: function () {
    var injectDependenciesAndConstants = function () {
        this.spawnCommand('gulp', ['install']);
    };

    this.installDependencies({
      bower: true,
      npm: false,
      callback: injectDependenciesAndConstants.bind(this)
    });
  },

  end: function () {
    this.log('\n' + chalk.bold.green('Auditing enabled for entities, you will have an option to enable audit while creating new entities as well'));
    this.log('\n' + chalk.bold.green('I\'m running gulp install now'));
  }


});
