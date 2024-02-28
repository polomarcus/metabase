(ns metabase.transforms.specs
  (:require
   [malli.core :as mc]
   [malli.transform :as mtx]
   [medley.core :as m]
   [metabase.domain-entities.specs :refer [MBQL]]
   [metabase.mbql.normalize :as mbql.normalize]
   [metabase.mbql.schema :as mbql.s]
   [metabase.mbql.util :as mbql.u]
   [metabase.util :as u]
   [metabase.util.yaml :as yaml]))

(def ^:private Source :string)

(def ^:private Dimension :string)

(def ^:private Breakout
  [:sequential
   {:decode/transform-spec (fn [breakouts]
                             (for [breakout (u/one-or-many breakouts)]
                               (if (mc/validate MBQL breakout)
                                 [:dimension breakout]
                                 breakout)))}
   MBQL])

(defn- extract-dimensions
  [mbql]
  (mbql.u/match (mbql.normalize/normalize mbql) [:dimension dimension & _] dimension))

(def ^:private ^{:arglists '([m])} stringify-keys
  (partial m/map-keys name))

(def ^:private Dimension->MBQL
  [:map-of
   ;; Since `Aggregation` and `Expressions` are structurally the same, we can't use them directly
   {:decode/transform-spec
      (comp (partial u/topological-sort extract-dimensions)
            stringify-keys)}
   Dimension
   MBQL])

(def ^:private Aggregation Dimension->MBQL)

(def ^:private Expressions Dimension->MBQL)

(def ^:private Description :string)

(def ^:private Filter MBQL)

(def ^:private Limit pos-int?)

(def ^:private JoinStrategy
  [:schema
   {:decode/transform-spec keyword}
   mbql.s/JoinStrategy])

(def ^:private Joins
  [:sequential
   [:map
    [:source    Source]
    [:condition MBQL]
    [:strategy {:optional true} JoinStrategy]]])

(def ^:private TransformName :string)

(def Step
  "Transform step"
  [:map
   {:decode/transform-spec (fn [steps]
                             (->> steps
                                  stringify-keys
                                  (u/topological-sort (fn [{:keys [source joins]}]
                                                        (conj (map :source joins) source)))))}
   [:source    Source]
   [:name      Source]
   [:transform TransformName]
   [:aggregation {:optional true} Aggregation]
   [:breakout    {:optional true} Breakout]
   [:expressions {:optional true} Expressions]
   [:joins       {:optional true} Joins]
   [:description {:optional true} Description]
   [:limit       {:optional true} Limit]
   [:filter      {:optional true} Filter]])

(def ^:private Steps [:map-of Source Step])

(def ^:private DomainEntity :string)

(def ^:private Requires
  [:sequential
   {:decode/transform-spec u/one-or-many}
   DomainEntity])

(def ^:private Provides
  [:sequential
   {:decode/transform-spec u/one-or-many}
   DomainEntity])

(def TransformSpec
  "Transform spec"
  [:map
   [:name     TransformName]
   [:requires Requires]
   [:provides Provides]
   [:steps    Steps]
   [:description {:optional true} Description]])

(defn- add-metadata-to-steps
  [spec]
  (update spec :steps (partial m/map-kv-vals (fn [step-name step]
                                               (assoc step
                                                 :name      step-name
                                                 :transform (:name spec))))))

(defn- coerce-to-transform-spec [spec]
  (mc/coerce TransformSpec
             spec
             (mtx/transformer
              mtx/string-transformer
              mtx/json-transformer
              (mtx/transformer {:name :transform-spec}))))

(def ^:private transforms-dir "transforms/")

(def transform-specs
  "List of registered dataset transforms."
  (delay (yaml/load-dir transforms-dir (comp coerce-to-transform-spec add-metadata-to-steps))))
