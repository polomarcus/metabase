(ns metabase.models.data-permissions
  (:require
   [clojure.string :as str]
   [malli.core :as mc]
   [metabase.models.interface :as mi]
   [metabase.util :as u]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.malli :as mu]
   [methodical.core :as methodical]
   [toucan2.core :as t2]))

(doto :model/DataPermissions
  (derive :metabase/model))

(methodical/defmethod t2/table-name :model/DataPermissions [_model] :data_permissions)

(t2/deftransforms :model/DataPermissions
  {:type       mi/transform-keyword
   :perm_value mi/transform-keyword
   ;; define keyword transformation for :value as well so that we can use it as an alias for :perm_value
   :value      mi/transform-keyword})


;;; ---------------------------------------- Permission definitions ---------------------------------------------------

;; IMPORTANT: If you add a new permission type, `:values` must be ordered from *most* permissive to *least* permissive.
;;
;;  - When fetching a user's permissions, the default behavior is to return the *most* permissive value from any group the
;;    user is in. This can be overridden by definding a custom implementation of `coalesce`.
;;
;;  - If a user does not have any value for the permission when it is fetched, the *least* permissive value is used as a
;;    fallback.


(def ^:private Permissions
  "Permissions which apply to individual databases or tables"
  {:data-access           {:model :model/Table :values [:unrestricted :no-self-service :block]}
   :download-results      {:model :model/Table :values [:one-million-rows :ten-thousand-rows :no]}
   :manage-table-metadata {:model :model/Table :values [:yes :no]}

   :native-query-editing {:model :model/Database :values [:yes :no]}
   :manage-database      {:model :model/Database :values [:yes :no]}})

(def PermissionType
  "Malli spec for valid permission types."
  (into [:enum {:error/message "Invalid permission type"}]
        (keys Permissions)))

(def PermissionValue
  "Malli spec for a keyword that matches any value in [[Permissions]]."
  (into [:enum {:error/message "Invalid permission value"}]
        (distinct (mapcat :values (vals Permissions)))))


;;; ------------------------------------------- Misc Utils ------------------------------------------------------------

(defn- least-permissive-value
  "The *least* permissive value for a given perm type. This value is used as a fallback when a user does not have a
  value for the permission in the database."
  [perm-type]
  (-> Permissions perm-type :values last))

(defn- most-permissive-value
  "The *most* permissive value for a given perm type. This is the default value for superusers."
  [perm-type]
  (-> Permissions perm-type :values first))

(def ^:private model-by-perm-type
  "A map from permission types directly to model identifiers (or `nil`)."
  (update-vals Permissions :model))

(defn- assert-value-matches-perm-type
  [perm-type perm-value]
  (when-not (contains? (set (get-in Permissions [perm-type :values])) perm-value)
    (throw (ex-info (tru "Permission type {0} cannot be set to {1}" perm-type perm-value)
                    {perm-type (Permissions perm-type)}))))


;;; ---------------------------------------- Fetching a user's permissions --------------------------------------------

(defmulti coalesce
  "Coalesce a set of permission values into a single value. This is used to determine the permission to enforce for a
  user in multiple groups with conflicting permissions. By default, this returns the *most* permissive value that the
  user has in any group.

  For instance,
  - Given an empty set, we return the most permissive.
    (coalesce :settings-access #{}) => :yes
  - Given a set with values, we select the most permissive option in the set.
    (coalesce :settings-access #{:view :no-access}) => :view"
  {:arglists '([perm-type perm-values])}
  (fn [perm-type _perm-values] perm-type))

(defmethod coalesce :default
  [perm-type perm-values]
  (let [ordered-values (-> Permissions perm-type :values)]
    (def ordered-values ordered-values)
    (first (filter (set perm-values) ordered-values))))

(mu/defn database-permission-for-user :- PermissionValue
  "Returns the effective permission value for a given user, permission type, and database ID. If the user has
  multiple permissions for the given type in different groups, they are coalesced into a single value."
  [user-id perm-type database-id]
  (when (not= :model/Database (model-by-perm-type perm-type))
    (throw (ex-info (tru "Permission type {0} is a table-level permission." perm-type)
                    {perm-type (Permissions perm-type)})))
  (if (t2/select-one-fn :is_superuser :model/User :id user-id)
    (most-permissive-value perm-type)
    (let [perm-values (t2/select-fn-set :value
                                        :model/DataPermissions
                                        {:select [[:p.perm_value :value]]
                                         :from [[:permissions_group_membership :pgm]]
                                         :join [[:permissions_group :pg] [:= :pg.id :pgm.group_id]
                                                [:data_permissions :p]   [:= :p.group_id :pg.id]]
                                         :where [:and
                                                 [:= :pgm.user_id user-id]
                                                 [:= :p.type (name perm-type)]
                                                 [:= :p.db_id database-id]]})]
      (or (coalesce perm-type perm-values)
          (least-permissive-value perm-type)))))

(mu/defn table-permission-for-user :- PermissionValue
  "Returns the effective permission value for a given user, permission type, and database ID, and table ID. If the user
  has multiple permissions for the given type in different groups, they are coalesced into a single value."
  [user-id perm-type database-id table-id]
  (when (not= :model/Table (model-by-perm-type perm-type))
    (throw (ex-info (tru "Permission type {0} is a table-level permission." perm-type)
                    {perm-type (Permissions perm-type)})))
  (if (t2/select-one-fn :is_superuser :model/User :id user-id)
    (most-permissive-value perm-type)
    (let [perm-values (t2/select-fn-set :value
                                        :model/DataPermissions
                                        {:select [[:p.perm_value :value]]
                                         :from [[:permissions_group_membership :pgm]]
                                         :join [[:permissions_group :pg] [:= :pg.id :pgm.group_id]
                                                [:data_permissions :p]   [:= :p.group_id :pg.id]]
                                         :where [:and
                                                 [:= :pgm.user_id user-id]
                                                 [:= :p.type (name perm-type)]
                                                 [:= :p.db_id database-id]
                                                 [:or
                                                  [:= :table_id table-id]
                                                  [:= :table_id nil]]]})]
      (or (coalesce perm-type perm-values)
          (least-permissive-value perm-type)))))


;;; ---------------------------------------- Fetching the data permissions graph --------------------------------------

(comment
  ;; General hierarchy of the data access permissions graph
  {#_:group-id 1
   {#_:db-id 1
    {#_:perm-type :data-access
     {#_:schema-name "PUBLIC"
      {#_:table-id 1 :unrestricted}}}}})

(defn data-permissions-graph
  "Returns a tree representation of all data permissions. Can be optionally filtered by group ID, database ID,
  and/or permission type. This is intended to power the permissions editor in the admin panel, and should not be used
  for permission enforcement, as it will read much more data than necessary."
  [& {:keys [group-id db-id perm-type]}]
  (let [data-perms (t2/select [:model/DataPermissions
                               :type
                               [:group_id :group-id]
                               [:perm_value :value]
                               [:db_id :db-id]
                               :schema
                               [:table_id :table-id]]
                              {:where [:and
                                       (when db-id [:= :db_id db-id])
                                       (when group-id [:= :group_id group-id])
                                       (when perm-type [:= :type (name perm-type)])]})]
    (reduce
     (fn [graph {group-id  :group-id
                 perm-type :type
                 value     :value
                 db-id     :db-id
                 schema    :schema
                 table-id  :table-id}]
       (let [schema   (or schema "")
             path     (if table-id
                        [group-id db-id perm-type schema table-id]
                        [group-id db-id perm-type])]
         (assoc-in graph path value)))
     {}
     data-perms)))


;;; --------------------------------------------- Updating permissions ------------------------------------------------

(defn- assert-valid-permission
  [{:keys [type perm_value] :as permission}]
  (when-not (mc/validate PermissionType type)
    (throw (ex-info (str/join (mu/explain PermissionType type)) permission)))
  (assert-value-matches-perm-type type perm_value))

(t2/define-before-insert :model/DataPermissions
  [permission]
  (assert-valid-permission permission)
  permission)

(t2/define-before-update :model/DataPermissions
  [permission]
  (assert-valid-permission permission)
  permission)

(def ^:private TheIdable
  "An ID, or something with an ID."
  [:or pos-int? [:map [:id pos-int?]]])

(mu/defn set-database-permission!
  "Sets a single permission to a specified value for a given group and database. If a permission value already exists
   for the specified group and object, it will be updated to the new value.

   Block permissions (i.e. :data-access :block) can only be set at the database-level, despite :data-access being a
   table-level permission."
  [group-or-id :- TheIdable
   db-or-id    :- TheIdable
   perm-type   :- :keyword
   value       :- :keyword]
  (when (and (not= :model/Database (model-by-perm-type perm-type))
             (not= [:data-access :block] [perm-type value]))
    (throw (ex-info (tru "Permission type {0} cannot be set on databases." perm-type)
                    {perm-type (Permissions perm-type)})))
  (t2/with-transaction [_conn]
    (let [group-id (u/the-id group-or-id)
          db-id    (u/the-id db-or-id)]
      (t2/delete! :model/DataPermissions :type perm-type :group_id group-id :db_id db-id)
      (t2/insert! :model/DataPermissions {:type       perm-type
                                          :group_id   group-id
                                          :perm_value value
                                          :db_id      db-id}))))

(mu/defn set-table-permission!
  "Sets a single permission to a specified value for a given group and DB or table. If a permission value already exists
  for the specified group and object, it will be updated to the new value.

  If setting a table-level permission, and the permission is currently set at the database-level, the database-level permission
  is removed and table-level rows are are added for all of its tables. Similarly, if setting a table-level permission to a value
  that results in all of the database's tables having the same permission, it is replaced with a single database-level row."
  [group-or-id :- TheIdable
   table-or-id :- TheIdable
   perm-type   :- :keyword
   value       :- :keyword]
  (when (not= :model/Table (model-by-perm-type perm-type))
    (throw (ex-info (tru "Permission type {0} cannot be set on tables." perm-type)
                    {perm-type (Permissions perm-type)})))
  (when (= [:data-access :block] [perm-type value])
    (throw (ex-info (tru "Block permissions must be set at the database-level only.")
                    {})))
  (t2/with-transaction [_conn]
    (let [group-id                  (u/the-id group-or-id)
          {:keys [id db_id schema]} (if (map? table-or-id)
                                      table-or-id
                                      (t2/select-one [:model/Table :id :db_id :schema] :id table-or-id))
          new-perm                  {:type       perm-type
                                     :group_id   group-id
                                     :perm_value value
                                     :db_id      db_id
                                     :table_id   id
                                     :schema     schema}
          existing-db-perm          (t2/select-one :model/DataPermissions
                                                   {:where
                                                    [:and
                                                     [:= :type (name perm-type)]
                                                     [:= :group_id group-id]
                                                     [:= :db_id db_id]
                                                     [:= :table_id nil]]})
          existing-db-perm-value    (:perm_value existing-db-perm)]
      (if existing-db-perm
        (when (not= value existing-db-perm-value)
          ;; If we're setting a table permission to a value that is different from the database-level permission, we need
          ;; to replace it with individual permission rows for every table in the database instead.
          ;; Important: We only want to do this in the branch where a DB-level perm exists, because otherwise we'd be
          ;; reading the entire table list for every table-level perm we set.
          (let [other-tables    (t2/select :model/Table {:where [:and
                                                                 [:= :db_id db_id]
                                                                 [:not= :id id]]})
                other-new-perms (map (fn [table]
                                       {:type       perm-type
                                        :group_id   group-id
                                        :perm_value existing-db-perm-value
                                        :db_id      db_id
                                        :table_id   (:id table)
                                        :schema     schema})
                                     other-tables)]
            (t2/delete! :model/DataPermissions :id (:id existing-db-perm))
            (t2/insert! :model/DataPermissions (conj other-new-perms new-perm))))
        (let [existing-table-perms (t2/select :model/DataPermissions
                                              :type (name perm-type)
                                              :group_id group-id
                                              :db_id db_id
                                              {:where [:and
                                                       [:not= :table_id nil]
                                                       [:not= :table_id id]]})
              existing-table-values (set (map :perm_value existing-table-perms))]
          (if (and (= (count existing-table-values) 1)
                   (existing-table-values value))
            ;; If all tables would have the same permissions after we update this one, we can replace all of the table
            ;; perms with a DB-level perm instead.
            (do
              (t2/delete! :model/DataPermissions {:where [:in id (conj (map :id existing-table-perms) id)]})
              (t2/insert! :model/DataPermissions {:type       perm-type
                                                  :group_id   group-id
                                                  :perm_value value
                                                  :db_id      db_id}))
            ;; Otherwise, just replace the row for the individual table perm
            (do
              (t2/delete! :model/DataPermissions :type perm-type :group_id group-id :table_id id)
              (t2/insert! :model/DataPermissions new-perm))))))))